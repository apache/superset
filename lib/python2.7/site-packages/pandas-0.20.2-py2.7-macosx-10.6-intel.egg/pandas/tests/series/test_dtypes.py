# coding=utf-8
# pylint: disable-msg=E1101,W0612

import pytest

from datetime import datetime

import sys
import string
import warnings

from numpy import nan
import numpy as np

from pandas import Series, Timestamp, Timedelta, DataFrame, date_range

from pandas.compat import lrange, range, u
from pandas import compat
import pandas.util.testing as tm

from .common import TestData


class TestSeriesDtypes(TestData):

    @pytest.mark.parametrize("dtype", ["float32", "float64",
                                       "int64", "int32"])
    def test_astype(self, dtype):
        s = Series(np.random.randn(5), name='foo')
        as_typed = s.astype(dtype)

        assert as_typed.dtype == dtype
        assert as_typed.name == s.name

    def test_dtype(self):

        assert self.ts.dtype == np.dtype('float64')
        assert self.ts.dtypes == np.dtype('float64')
        assert self.ts.ftype == 'float64:dense'
        assert self.ts.ftypes == 'float64:dense'
        tm.assert_series_equal(self.ts.get_dtype_counts(),
                               Series(1, ['float64']))
        tm.assert_series_equal(self.ts.get_ftype_counts(),
                               Series(1, ['float64:dense']))

    @pytest.mark.parametrize("value", [np.nan, np.inf])
    @pytest.mark.parametrize("dtype", [np.int32, np.int64])
    def test_astype_cast_nan_inf_int(self, dtype, value):
        # gh-14265: check NaN and inf raise error when converting to int
        msg = 'Cannot convert non-finite values \\(NA or inf\\) to integer'
        s = Series([value])

        with tm.assert_raises_regex(ValueError, msg):
            s.astype(dtype)

    @pytest.mark.parametrize("dtype", [int, np.int8, np.int64])
    def test_astype_cast_object_int_fail(self, dtype):
        arr = Series(["car", "house", "tree", "1"])
        with pytest.raises(ValueError):
            arr.astype(dtype)

    def test_astype_cast_object_int(self):
        arr = Series(['1', '2', '3', '4'], dtype=object)
        result = arr.astype(int)

        tm.assert_series_equal(result, Series(np.arange(1, 5)))

    def test_astype_datetimes(self):
        import pandas._libs.tslib as tslib
        s = Series(tslib.iNaT, dtype='M8[ns]', index=lrange(5))

        s = s.astype('O')
        assert s.dtype == np.object_

        s = Series([datetime(2001, 1, 2, 0, 0)])

        s = s.astype('O')
        assert s.dtype == np.object_

        s = Series([datetime(2001, 1, 2, 0, 0) for i in range(3)])

        s[1] = np.nan
        assert s.dtype == 'M8[ns]'

        s = s.astype('O')
        assert s.dtype == np.object_

    @pytest.mark.parametrize("dtype", [compat.text_type, np.str_])
    @pytest.mark.parametrize("series", [Series([string.digits * 10,
                                                tm.rands(63),
                                                tm.rands(64),
                                                tm.rands(1000)]),
                                        Series([string.digits * 10,
                                                tm.rands(63),
                                                tm.rands(64), nan, 1.0])])
    def test_astype_str_map(self, dtype, series):
        # see gh-4405
        result = series.astype(dtype)
        expected = series.map(compat.text_type)
        tm.assert_series_equal(result, expected)

    @pytest.mark.parametrize("dtype", [str, compat.text_type])
    def test_astype_str_cast(self, dtype):
        # see gh-9757: test str and unicode on python 2.x
        # and just str on python 3.x
        ts = Series([Timestamp('2010-01-04 00:00:00')])
        s = ts.astype(dtype)

        expected = Series([dtype('2010-01-04')])
        tm.assert_series_equal(s, expected)

        ts = Series([Timestamp('2010-01-04 00:00:00', tz='US/Eastern')])
        s = ts.astype(dtype)

        expected = Series([dtype('2010-01-04 00:00:00-05:00')])
        tm.assert_series_equal(s, expected)

        td = Series([Timedelta(1, unit='d')])
        s = td.astype(dtype)

        expected = Series([dtype('1 days 00:00:00.000000000')])
        tm.assert_series_equal(s, expected)

    def test_astype_unicode(self):
        # see gh-7758: A bit of magic is required to set
        # default encoding to utf-8
        digits = string.digits
        test_series = [
            Series([digits * 10, tm.rands(63), tm.rands(64), tm.rands(1000)]),
            Series([u('データーサイエンス、お前はもう死んでいる')]),
        ]

        former_encoding = None

        if not compat.PY3:
            # In Python, we can force the default encoding for this test
            former_encoding = sys.getdefaultencoding()
            reload(sys)  # noqa

            sys.setdefaultencoding("utf-8")
        if sys.getdefaultencoding() == "utf-8":
            test_series.append(Series([u('野菜食べないとやばい')
                                       .encode("utf-8")]))

        for s in test_series:
            res = s.astype("unicode")
            expec = s.map(compat.text_type)
            tm.assert_series_equal(res, expec)

        # Restore the former encoding
        if former_encoding is not None and former_encoding != "utf-8":
            reload(sys)  # noqa
            sys.setdefaultencoding(former_encoding)

    def test_astype_dict(self):
        # see gh-7271
        s = Series(range(0, 10, 2), name='abc')

        result = s.astype({'abc': str})
        expected = Series(['0', '2', '4', '6', '8'], name='abc')
        tm.assert_series_equal(result, expected)

        result = s.astype({'abc': 'float64'})
        expected = Series([0.0, 2.0, 4.0, 6.0, 8.0], dtype='float64',
                          name='abc')
        tm.assert_series_equal(result, expected)

        with pytest.raises(KeyError):
            s.astype({'abc': str, 'def': str})

        with pytest.raises(KeyError):
            s.astype({0: str})

    def test_astype_generic_timestamp_deprecated(self):
        # see gh-15524
        data = [1]

        with tm.assert_produces_warning(FutureWarning,
                                        check_stacklevel=False):
            s = Series(data)
            dtype = np.datetime64
            result = s.astype(dtype)
            expected = Series(data, dtype=dtype)
            tm.assert_series_equal(result, expected)

        with tm.assert_produces_warning(FutureWarning,
                                        check_stacklevel=False):
            s = Series(data)
            dtype = np.timedelta64
            result = s.astype(dtype)
            expected = Series(data, dtype=dtype)
            tm.assert_series_equal(result, expected)

    @pytest.mark.parametrize("dtype", np.typecodes['All'])
    def test_astype_empty_constructor_equality(self, dtype):
        # see gh-15524

        if dtype not in ('S', 'V'):  # poor support (if any) currently
            with warnings.catch_warnings(record=True):
                # Generic timestamp dtypes ('M' and 'm') are deprecated,
                # but we test that already in series/test_constructors.py

                init_empty = Series([], dtype=dtype)
                as_type_empty = Series([]).astype(dtype)
                tm.assert_series_equal(init_empty, as_type_empty)

    def test_complex(self):
        # see gh-4819: complex access for ndarray compat
        a = np.arange(5, dtype=np.float64)
        b = Series(a + 4j * a)

        tm.assert_numpy_array_equal(a, b.real)
        tm.assert_numpy_array_equal(4 * a, b.imag)

        b.real = np.arange(5) + 5
        tm.assert_numpy_array_equal(a + 5, b.real)
        tm.assert_numpy_array_equal(4 * a, b.imag)

    def test_arg_for_errors_in_astype(self):
        # see gh-14878
        s = Series([1, 2, 3])

        with pytest.raises(ValueError):
            s.astype(np.float64, errors=False)

        with tm.assert_produces_warning(FutureWarning):
            s.astype(np.int8, raise_on_error=True)

        s.astype(np.int8, errors='raise')

    def test_intercept_astype_object(self):
        series = Series(date_range('1/1/2000', periods=10))

        # This test no longer makes sense, as
        # Series is by default already M8[ns].
        expected = series.astype('object')

        df = DataFrame({'a': series,
                        'b': np.random.randn(len(series))})
        exp_dtypes = Series([np.dtype('datetime64[ns]'),
                             np.dtype('float64')], index=['a', 'b'])
        tm.assert_series_equal(df.dtypes, exp_dtypes)

        result = df.values.squeeze()
        assert (result[:, 0] == expected.values).all()

        df = DataFrame({'a': series, 'b': ['foo'] * len(series)})

        result = df.values.squeeze()
        assert (result[:, 0] == expected.values).all()
