# -*- coding: utf-8 -*-

import numpy as np
import pandas._libs.lib as lib
import pandas.util.testing as tm

from pandas.compat import long, u


class TestParseSQL(object):

    def test_convert_sql_column_floats(self):
        arr = np.array([1.5, None, 3, 4.2], dtype=object)
        result = lib.convert_sql_column(arr)
        expected = np.array([1.5, np.nan, 3, 4.2], dtype='f8')
        tm.assert_numpy_array_equal(result, expected)

    def test_convert_sql_column_strings(self):
        arr = np.array(['1.5', None, '3', '4.2'], dtype=object)
        result = lib.convert_sql_column(arr)
        expected = np.array(['1.5', np.nan, '3', '4.2'], dtype=object)
        tm.assert_numpy_array_equal(result, expected)

    def test_convert_sql_column_unicode(self):
        arr = np.array([u('1.5'), None, u('3'), u('4.2')],
                       dtype=object)
        result = lib.convert_sql_column(arr)
        expected = np.array([u('1.5'), np.nan, u('3'), u('4.2')],
                            dtype=object)
        tm.assert_numpy_array_equal(result, expected)

    def test_convert_sql_column_ints(self):
        arr = np.array([1, 2, 3, 4], dtype='O')
        arr2 = np.array([1, 2, 3, 4], dtype='i4').astype('O')
        result = lib.convert_sql_column(arr)
        result2 = lib.convert_sql_column(arr2)
        expected = np.array([1, 2, 3, 4], dtype='i8')
        tm.assert_numpy_array_equal(result, expected)
        tm.assert_numpy_array_equal(result2, expected)

        arr = np.array([1, 2, 3, None, 4], dtype='O')
        result = lib.convert_sql_column(arr)
        expected = np.array([1, 2, 3, np.nan, 4], dtype='f8')
        tm.assert_numpy_array_equal(result, expected)

    def test_convert_sql_column_longs(self):
        arr = np.array([long(1), long(2), long(3), long(4)], dtype='O')
        result = lib.convert_sql_column(arr)
        expected = np.array([1, 2, 3, 4], dtype='i8')
        tm.assert_numpy_array_equal(result, expected)

        arr = np.array([long(1), long(2), long(3), None, long(4)], dtype='O')
        result = lib.convert_sql_column(arr)
        expected = np.array([1, 2, 3, np.nan, 4], dtype='f8')
        tm.assert_numpy_array_equal(result, expected)

    def test_convert_sql_column_bools(self):
        arr = np.array([True, False, True, False], dtype='O')
        result = lib.convert_sql_column(arr)
        expected = np.array([True, False, True, False], dtype=bool)
        tm.assert_numpy_array_equal(result, expected)

        arr = np.array([True, False, None, False], dtype='O')
        result = lib.convert_sql_column(arr)
        expected = np.array([True, False, np.nan, False], dtype=object)
        tm.assert_numpy_array_equal(result, expected)

    def test_convert_sql_column_decimals(self):
        from decimal import Decimal
        arr = np.array([Decimal('1.5'), None, Decimal('3'), Decimal('4.2')])
        result = lib.convert_sql_column(arr)
        expected = np.array([1.5, np.nan, 3, 4.2], dtype='f8')
        tm.assert_numpy_array_equal(result, expected)

    def test_convert_downcast_int64(self):
        from pandas._libs.parsers import na_values

        arr = np.array([1, 2, 7, 8, 10], dtype=np.int64)
        expected = np.array([1, 2, 7, 8, 10], dtype=np.int8)

        # default argument
        result = lib.downcast_int64(arr, na_values)
        tm.assert_numpy_array_equal(result, expected)

        result = lib.downcast_int64(arr, na_values, use_unsigned=False)
        tm.assert_numpy_array_equal(result, expected)

        expected = np.array([1, 2, 7, 8, 10], dtype=np.uint8)
        result = lib.downcast_int64(arr, na_values, use_unsigned=True)
        tm.assert_numpy_array_equal(result, expected)

        # still cast to int8 despite use_unsigned=True
        # because of the negative number as an element
        arr = np.array([1, 2, -7, 8, 10], dtype=np.int64)
        expected = np.array([1, 2, -7, 8, 10], dtype=np.int8)
        result = lib.downcast_int64(arr, na_values, use_unsigned=True)
        tm.assert_numpy_array_equal(result, expected)

        arr = np.array([1, 2, 7, 8, 300], dtype=np.int64)
        expected = np.array([1, 2, 7, 8, 300], dtype=np.int16)
        result = lib.downcast_int64(arr, na_values)
        tm.assert_numpy_array_equal(result, expected)

        int8_na = na_values[np.int8]
        int64_na = na_values[np.int64]
        arr = np.array([int64_na, 2, 3, 10, 15], dtype=np.int64)
        expected = np.array([int8_na, 2, 3, 10, 15], dtype=np.int8)
        result = lib.downcast_int64(arr, na_values)
        tm.assert_numpy_array_equal(result, expected)
