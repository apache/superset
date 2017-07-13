# -*- coding: utf-8 -*-

"""
These test the private routines in types/cast.py

"""

import pytest
from datetime import datetime, timedelta, date
import numpy as np

from pandas import Timedelta, Timestamp, DatetimeIndex, DataFrame, NaT

from pandas.core.dtypes.cast import (
    maybe_downcast_to_dtype,
    maybe_convert_objects,
    infer_dtype_from_scalar,
    infer_dtype_from_array,
    maybe_convert_string_to_object,
    maybe_convert_scalar,
    find_common_type)
from pandas.core.dtypes.dtypes import (
    CategoricalDtype,
    DatetimeTZDtype,
    PeriodDtype)
from pandas.util import testing as tm


class TestMaybeDowncast(object):

    def test_downcast_conv(self):
        # test downcasting

        arr = np.array([8.5, 8.6, 8.7, 8.8, 8.9999999999995])
        result = maybe_downcast_to_dtype(arr, 'infer')
        assert (np.array_equal(result, arr))

        arr = np.array([8., 8., 8., 8., 8.9999999999995])
        result = maybe_downcast_to_dtype(arr, 'infer')
        expected = np.array([8, 8, 8, 8, 9])
        assert (np.array_equal(result, expected))

        arr = np.array([8., 8., 8., 8., 9.0000000000005])
        result = maybe_downcast_to_dtype(arr, 'infer')
        expected = np.array([8, 8, 8, 8, 9])
        assert (np.array_equal(result, expected))

        # conversions

        expected = np.array([1, 2])
        for dtype in [np.float64, object, np.int64]:
            arr = np.array([1.0, 2.0], dtype=dtype)
            result = maybe_downcast_to_dtype(arr, 'infer')
            tm.assert_almost_equal(result, expected, check_dtype=False)

        for dtype in [np.float64, object]:
            expected = np.array([1.0, 2.0, np.nan], dtype=dtype)
            arr = np.array([1.0, 2.0, np.nan], dtype=dtype)
            result = maybe_downcast_to_dtype(arr, 'infer')
            tm.assert_almost_equal(result, expected)

        # empties
        for dtype in [np.int32, np.float64, np.float32, np.bool_,
                      np.int64, object]:
            arr = np.array([], dtype=dtype)
            result = maybe_downcast_to_dtype(arr, 'int64')
            tm.assert_almost_equal(result, np.array([], dtype=np.int64))
            assert result.dtype == np.int64

    def test_datetimelikes_nan(self):
        arr = np.array([1, 2, np.nan])
        exp = np.array([1, 2, np.datetime64('NaT')], dtype='datetime64[ns]')
        res = maybe_downcast_to_dtype(arr, 'datetime64[ns]')
        tm.assert_numpy_array_equal(res, exp)

        exp = np.array([1, 2, np.timedelta64('NaT')], dtype='timedelta64[ns]')
        res = maybe_downcast_to_dtype(arr, 'timedelta64[ns]')
        tm.assert_numpy_array_equal(res, exp)

    def test_datetime_with_timezone(self):
        # GH 15426
        ts = Timestamp("2016-01-01 12:00:00", tz='US/Pacific')
        exp = DatetimeIndex([ts, ts])
        res = maybe_downcast_to_dtype(exp, exp.dtype)
        tm.assert_index_equal(res, exp)

        res = maybe_downcast_to_dtype(exp.asi8, exp.dtype)
        tm.assert_index_equal(res, exp)


class TestInferDtype(object):

    def test_infer_dtype_from_scalar(self):
        # Test that _infer_dtype_from_scalar is returning correct dtype for int
        # and float.

        for dtypec in [np.uint8, np.int8, np.uint16, np.int16, np.uint32,
                       np.int32, np.uint64, np.int64]:
            data = dtypec(12)
            dtype, val = infer_dtype_from_scalar(data)
            assert dtype == type(data)

        data = 12
        dtype, val = infer_dtype_from_scalar(data)
        assert dtype == np.int64

        for dtypec in [np.float16, np.float32, np.float64]:
            data = dtypec(12)
            dtype, val = infer_dtype_from_scalar(data)
            assert dtype == dtypec

        data = np.float(12)
        dtype, val = infer_dtype_from_scalar(data)
        assert dtype == np.float64

        for data in [True, False]:
            dtype, val = infer_dtype_from_scalar(data)
            assert dtype == np.bool_

        for data in [np.complex64(1), np.complex128(1)]:
            dtype, val = infer_dtype_from_scalar(data)
            assert dtype == np.complex_

        for data in [np.datetime64(1, 'ns'), Timestamp(1),
                     datetime(2000, 1, 1, 0, 0)]:
            dtype, val = infer_dtype_from_scalar(data)
            assert dtype == 'M8[ns]'

        for data in [np.timedelta64(1, 'ns'), Timedelta(1),
                     timedelta(1)]:
            dtype, val = infer_dtype_from_scalar(data)
            assert dtype == 'm8[ns]'

        for data in [date(2000, 1, 1),
                     Timestamp(1, tz='US/Eastern'), 'foo']:
            dtype, val = infer_dtype_from_scalar(data)
            assert dtype == np.object_

    @pytest.mark.parametrize(
        "arr, expected",
        [('foo', np.object_),
         (b'foo', np.object_),
         (1, np.int_),
         (1.5, np.float_),
         ([1], np.int_),
         (np.array([1]), np.int_),
         ([np.nan, 1, ''], np.object_),
         (np.array([[1.0, 2.0]]), np.float_),
         (Timestamp('20160101'), np.object_),
         (np.datetime64('2016-01-01'), np.dtype('<M8[D]')),
         ])
    def test_infer_dtype_from_array(self, arr, expected):

        # these infer specifically to numpy dtypes
        dtype, _ = infer_dtype_from_array(arr)
        assert dtype == expected


class TestMaybe(object):

    def test_maybe_convert_string_to_array(self):
        result = maybe_convert_string_to_object('x')
        tm.assert_numpy_array_equal(result, np.array(['x'], dtype=object))
        assert result.dtype == object

        result = maybe_convert_string_to_object(1)
        assert result == 1

        arr = np.array(['x', 'y'], dtype=str)
        result = maybe_convert_string_to_object(arr)
        tm.assert_numpy_array_equal(result, np.array(['x', 'y'], dtype=object))
        assert result.dtype == object

        # unicode
        arr = np.array(['x', 'y']).astype('U')
        result = maybe_convert_string_to_object(arr)
        tm.assert_numpy_array_equal(result, np.array(['x', 'y'], dtype=object))
        assert result.dtype == object

        # object
        arr = np.array(['x', 2], dtype=object)
        result = maybe_convert_string_to_object(arr)
        tm.assert_numpy_array_equal(result, np.array(['x', 2], dtype=object))
        assert result.dtype == object

    def test_maybe_convert_scalar(self):

        # pass thru
        result = maybe_convert_scalar('x')
        assert result == 'x'
        result = maybe_convert_scalar(np.array([1]))
        assert result == np.array([1])

        # leave scalar dtype
        result = maybe_convert_scalar(np.int64(1))
        assert result == np.int64(1)
        result = maybe_convert_scalar(np.int32(1))
        assert result == np.int32(1)
        result = maybe_convert_scalar(np.float32(1))
        assert result == np.float32(1)
        result = maybe_convert_scalar(np.int64(1))
        assert result == np.float64(1)

        # coerce
        result = maybe_convert_scalar(1)
        assert result == np.int64(1)
        result = maybe_convert_scalar(1.0)
        assert result == np.float64(1)
        result = maybe_convert_scalar(Timestamp('20130101'))
        assert result == Timestamp('20130101').value
        result = maybe_convert_scalar(datetime(2013, 1, 1))
        assert result == Timestamp('20130101').value
        result = maybe_convert_scalar(Timedelta('1 day 1 min'))
        assert result == Timedelta('1 day 1 min').value

    def test_maybe_infer_to_datetimelike(self):
        # GH16362
        # pandas=0.20.1 raises IndexError: tuple index out of range
        result = DataFrame(np.array([[NaT, 'a', 'b', 0],
                                     [NaT, 'b', 'c', 1]]))
        assert result.size == 8
        # this construction was fine
        result = DataFrame(np.array([[NaT, 'a', 0],
                                     [NaT, 'b', 1]]))
        assert result.size == 6


class TestConvert(object):

    def test_maybe_convert_objects_copy(self):
        values = np.array([1, 2])

        out = maybe_convert_objects(values, copy=False)
        assert values is out

        out = maybe_convert_objects(values, copy=True)
        assert values is not out

        values = np.array(['apply', 'banana'])
        out = maybe_convert_objects(values, copy=False)
        assert values is out

        out = maybe_convert_objects(values, copy=True)
        assert values is not out


class TestCommonTypes(object):

    def test_numpy_dtypes(self):
        # (source_types, destination_type)
        testcases = (
            # identity
            ((np.int64,), np.int64),
            ((np.uint64,), np.uint64),
            ((np.float32,), np.float32),
            ((np.object,), np.object),

            # into ints
            ((np.int16, np.int64), np.int64),
            ((np.int32, np.uint32), np.int64),
            ((np.uint16, np.uint64), np.uint64),

            # into floats
            ((np.float16, np.float32), np.float32),
            ((np.float16, np.int16), np.float32),
            ((np.float32, np.int16), np.float32),
            ((np.uint64, np.int64), np.float64),
            ((np.int16, np.float64), np.float64),
            ((np.float16, np.int64), np.float64),

            # into others
            ((np.complex128, np.int32), np.complex128),
            ((np.object, np.float32), np.object),
            ((np.object, np.int16), np.object),

            # bool with int
            ((np.dtype('bool'), np.int64), np.object),
            ((np.dtype('bool'), np.int32), np.object),
            ((np.dtype('bool'), np.int16), np.object),
            ((np.dtype('bool'), np.int8), np.object),
            ((np.dtype('bool'), np.uint64), np.object),
            ((np.dtype('bool'), np.uint32), np.object),
            ((np.dtype('bool'), np.uint16), np.object),
            ((np.dtype('bool'), np.uint8), np.object),

            # bool with float
            ((np.dtype('bool'), np.float64), np.object),
            ((np.dtype('bool'), np.float32), np.object),

            ((np.dtype('datetime64[ns]'), np.dtype('datetime64[ns]')),
             np.dtype('datetime64[ns]')),
            ((np.dtype('timedelta64[ns]'), np.dtype('timedelta64[ns]')),
             np.dtype('timedelta64[ns]')),

            ((np.dtype('datetime64[ns]'), np.dtype('datetime64[ms]')),
             np.dtype('datetime64[ns]')),
            ((np.dtype('timedelta64[ms]'), np.dtype('timedelta64[ns]')),
             np.dtype('timedelta64[ns]')),

            ((np.dtype('datetime64[ns]'), np.dtype('timedelta64[ns]')),
             np.object),
            ((np.dtype('datetime64[ns]'), np.int64), np.object)
        )
        for src, common in testcases:
            assert find_common_type(src) == common

        with pytest.raises(ValueError):
            # empty
            find_common_type([])

    def test_categorical_dtype(self):
        dtype = CategoricalDtype()
        assert find_common_type([dtype]) == 'category'
        assert find_common_type([dtype, dtype]) == 'category'
        assert find_common_type([np.object, dtype]) == np.object

    def test_datetimetz_dtype(self):
        dtype = DatetimeTZDtype(unit='ns', tz='US/Eastern')
        assert find_common_type([dtype, dtype]) == 'datetime64[ns, US/Eastern]'

        for dtype2 in [DatetimeTZDtype(unit='ns', tz='Asia/Tokyo'),
                       np.dtype('datetime64[ns]'), np.object, np.int64]:
            assert find_common_type([dtype, dtype2]) == np.object
            assert find_common_type([dtype2, dtype]) == np.object

    def test_period_dtype(self):
        dtype = PeriodDtype(freq='D')
        assert find_common_type([dtype, dtype]) == 'period[D]'

        for dtype2 in [DatetimeTZDtype(unit='ns', tz='Asia/Tokyo'),
                       PeriodDtype(freq='2D'), PeriodDtype(freq='H'),
                       np.dtype('datetime64[ns]'), np.object, np.int64]:
            assert find_common_type([dtype, dtype2]) == np.object
            assert find_common_type([dtype2, dtype]) == np.object
