# -*- coding: utf-8 -*-

from warnings import catch_warnings
import numpy as np
from datetime import datetime
from pandas.util import testing as tm

import pandas as pd
from pandas.core import config as cf
from pandas.compat import u
from pandas._libs.tslib import iNaT
from pandas import (NaT, Float64Index, Series,
                    DatetimeIndex, TimedeltaIndex, date_range)
from pandas.core.dtypes.dtypes import DatetimeTZDtype
from pandas.core.dtypes.missing import (
    array_equivalent, isnull, notnull,
    na_value_for_dtype)


def test_notnull():
    assert notnull(1.)
    assert not notnull(None)
    assert not notnull(np.NaN)

    with cf.option_context("mode.use_inf_as_null", False):
        assert notnull(np.inf)
        assert notnull(-np.inf)

        arr = np.array([1.5, np.inf, 3.5, -np.inf])
        result = notnull(arr)
        assert result.all()

    with cf.option_context("mode.use_inf_as_null", True):
        assert not notnull(np.inf)
        assert not notnull(-np.inf)

        arr = np.array([1.5, np.inf, 3.5, -np.inf])
        result = notnull(arr)
        assert result.sum() == 2

    with cf.option_context("mode.use_inf_as_null", False):
        for s in [tm.makeFloatSeries(), tm.makeStringSeries(),
                  tm.makeObjectSeries(), tm.makeTimeSeries(),
                  tm.makePeriodSeries()]:
            assert (isinstance(isnull(s), Series))


class TestIsNull(object):

    def test_0d_array(self):
        assert isnull(np.array(np.nan))
        assert not isnull(np.array(0.0))
        assert not isnull(np.array(0))
        # test object dtype
        assert isnull(np.array(np.nan, dtype=object))
        assert not isnull(np.array(0.0, dtype=object))
        assert not isnull(np.array(0, dtype=object))

    def test_empty_object(self):

        for shape in [(4, 0), (4,)]:
            arr = np.empty(shape=shape, dtype=object)
            result = isnull(arr)
            expected = np.ones(shape=shape, dtype=bool)
            tm.assert_numpy_array_equal(result, expected)

    def test_isnull(self):
        assert not isnull(1.)
        assert isnull(None)
        assert isnull(np.NaN)
        assert float('nan')
        assert not isnull(np.inf)
        assert not isnull(-np.inf)

        # series
        for s in [tm.makeFloatSeries(), tm.makeStringSeries(),
                  tm.makeObjectSeries(), tm.makeTimeSeries(),
                  tm.makePeriodSeries()]:
            assert isinstance(isnull(s), Series)

        # frame
        for df in [tm.makeTimeDataFrame(), tm.makePeriodFrame(),
                   tm.makeMixedDataFrame()]:
            result = isnull(df)
            expected = df.apply(isnull)
            tm.assert_frame_equal(result, expected)

        # panel
        with catch_warnings(record=True):
            for p in [tm.makePanel(), tm.makePeriodPanel(),
                      tm.add_nans(tm.makePanel())]:
                result = isnull(p)
                expected = p.apply(isnull)
                tm.assert_panel_equal(result, expected)

        # panel 4d
        with catch_warnings(record=True):
            for p in [tm.makePanel4D(), tm.add_nans_panel4d(tm.makePanel4D())]:
                result = isnull(p)
                expected = p.apply(isnull)
                tm.assert_panel4d_equal(result, expected)

    def test_isnull_lists(self):
        result = isnull([[False]])
        exp = np.array([[False]])
        tm.assert_numpy_array_equal(result, exp)

        result = isnull([[1], [2]])
        exp = np.array([[False], [False]])
        tm.assert_numpy_array_equal(result, exp)

        # list of strings / unicode
        result = isnull(['foo', 'bar'])
        exp = np.array([False, False])
        tm.assert_numpy_array_equal(result, exp)

        result = isnull([u('foo'), u('bar')])
        exp = np.array([False, False])
        tm.assert_numpy_array_equal(result, exp)

    def test_isnull_nat(self):
        result = isnull([NaT])
        exp = np.array([True])
        tm.assert_numpy_array_equal(result, exp)

        result = isnull(np.array([NaT], dtype=object))
        exp = np.array([True])
        tm.assert_numpy_array_equal(result, exp)

    def test_isnull_numpy_nat(self):
        arr = np.array([NaT, np.datetime64('NaT'), np.timedelta64('NaT'),
                        np.datetime64('NaT', 's')])
        result = isnull(arr)
        expected = np.array([True] * 4)
        tm.assert_numpy_array_equal(result, expected)

    def test_isnull_datetime(self):
        assert not isnull(datetime.now())
        assert notnull(datetime.now())

        idx = date_range('1/1/1990', periods=20)
        exp = np.ones(len(idx), dtype=bool)
        tm.assert_numpy_array_equal(notnull(idx), exp)

        idx = np.asarray(idx)
        idx[0] = iNaT
        idx = DatetimeIndex(idx)
        mask = isnull(idx)
        assert mask[0]
        exp = np.array([True] + [False] * (len(idx) - 1), dtype=bool)
        tm.assert_numpy_array_equal(mask, exp)

        # GH 9129
        pidx = idx.to_period(freq='M')
        mask = isnull(pidx)
        assert mask[0]
        exp = np.array([True] + [False] * (len(idx) - 1), dtype=bool)
        tm.assert_numpy_array_equal(mask, exp)

        mask = isnull(pidx[1:])
        exp = np.zeros(len(mask), dtype=bool)
        tm.assert_numpy_array_equal(mask, exp)

    def test_datetime_other_units(self):
        idx = pd.DatetimeIndex(['2011-01-01', 'NaT', '2011-01-02'])
        exp = np.array([False, True, False])
        tm.assert_numpy_array_equal(isnull(idx), exp)
        tm.assert_numpy_array_equal(notnull(idx), ~exp)
        tm.assert_numpy_array_equal(isnull(idx.values), exp)
        tm.assert_numpy_array_equal(notnull(idx.values), ~exp)

        for dtype in ['datetime64[D]', 'datetime64[h]', 'datetime64[m]',
                      'datetime64[s]', 'datetime64[ms]', 'datetime64[us]',
                      'datetime64[ns]']:
            values = idx.values.astype(dtype)

            exp = np.array([False, True, False])
            tm.assert_numpy_array_equal(isnull(values), exp)
            tm.assert_numpy_array_equal(notnull(values), ~exp)

            exp = pd.Series([False, True, False])
            s = pd.Series(values)
            tm.assert_series_equal(isnull(s), exp)
            tm.assert_series_equal(notnull(s), ~exp)
            s = pd.Series(values, dtype=object)
            tm.assert_series_equal(isnull(s), exp)
            tm.assert_series_equal(notnull(s), ~exp)

    def test_timedelta_other_units(self):
        idx = pd.TimedeltaIndex(['1 days', 'NaT', '2 days'])
        exp = np.array([False, True, False])
        tm.assert_numpy_array_equal(isnull(idx), exp)
        tm.assert_numpy_array_equal(notnull(idx), ~exp)
        tm.assert_numpy_array_equal(isnull(idx.values), exp)
        tm.assert_numpy_array_equal(notnull(idx.values), ~exp)

        for dtype in ['timedelta64[D]', 'timedelta64[h]', 'timedelta64[m]',
                      'timedelta64[s]', 'timedelta64[ms]', 'timedelta64[us]',
                      'timedelta64[ns]']:
            values = idx.values.astype(dtype)

            exp = np.array([False, True, False])
            tm.assert_numpy_array_equal(isnull(values), exp)
            tm.assert_numpy_array_equal(notnull(values), ~exp)

            exp = pd.Series([False, True, False])
            s = pd.Series(values)
            tm.assert_series_equal(isnull(s), exp)
            tm.assert_series_equal(notnull(s), ~exp)
            s = pd.Series(values, dtype=object)
            tm.assert_series_equal(isnull(s), exp)
            tm.assert_series_equal(notnull(s), ~exp)

    def test_period(self):
        idx = pd.PeriodIndex(['2011-01', 'NaT', '2012-01'], freq='M')
        exp = np.array([False, True, False])
        tm.assert_numpy_array_equal(isnull(idx), exp)
        tm.assert_numpy_array_equal(notnull(idx), ~exp)

        exp = pd.Series([False, True, False])
        s = pd.Series(idx)
        tm.assert_series_equal(isnull(s), exp)
        tm.assert_series_equal(notnull(s), ~exp)
        s = pd.Series(idx, dtype=object)
        tm.assert_series_equal(isnull(s), exp)
        tm.assert_series_equal(notnull(s), ~exp)


def test_array_equivalent():
    assert array_equivalent(np.array([np.nan, np.nan]),
                            np.array([np.nan, np.nan]))
    assert array_equivalent(np.array([np.nan, 1, np.nan]),
                            np.array([np.nan, 1, np.nan]))
    assert array_equivalent(np.array([np.nan, None], dtype='object'),
                            np.array([np.nan, None], dtype='object'))
    assert array_equivalent(np.array([np.nan, 1 + 1j], dtype='complex'),
                            np.array([np.nan, 1 + 1j], dtype='complex'))
    assert not array_equivalent(
        np.array([np.nan, 1 + 1j], dtype='complex'), np.array(
            [np.nan, 1 + 2j], dtype='complex'))
    assert not array_equivalent(
        np.array([np.nan, 1, np.nan]), np.array([np.nan, 2, np.nan]))
    assert not array_equivalent(
        np.array(['a', 'b', 'c', 'd']), np.array(['e', 'e']))
    assert array_equivalent(Float64Index([0, np.nan]),
                            Float64Index([0, np.nan]))
    assert not array_equivalent(
        Float64Index([0, np.nan]), Float64Index([1, np.nan]))
    assert array_equivalent(DatetimeIndex([0, np.nan]),
                            DatetimeIndex([0, np.nan]))
    assert not array_equivalent(
        DatetimeIndex([0, np.nan]), DatetimeIndex([1, np.nan]))
    assert array_equivalent(TimedeltaIndex([0, np.nan]),
                            TimedeltaIndex([0, np.nan]))
    assert not array_equivalent(
        TimedeltaIndex([0, np.nan]), TimedeltaIndex([1, np.nan]))
    assert array_equivalent(DatetimeIndex([0, np.nan], tz='US/Eastern'),
                            DatetimeIndex([0, np.nan], tz='US/Eastern'))
    assert not array_equivalent(
        DatetimeIndex([0, np.nan], tz='US/Eastern'), DatetimeIndex(
            [1, np.nan], tz='US/Eastern'))
    assert not array_equivalent(
        DatetimeIndex([0, np.nan]), DatetimeIndex(
            [0, np.nan], tz='US/Eastern'))
    assert not array_equivalent(
        DatetimeIndex([0, np.nan], tz='CET'), DatetimeIndex(
            [0, np.nan], tz='US/Eastern'))
    assert not array_equivalent(
        DatetimeIndex([0, np.nan]), TimedeltaIndex([0, np.nan]))


def test_array_equivalent_compat():
    # see gh-13388
    m = np.array([(1, 2), (3, 4)], dtype=[('a', int), ('b', float)])
    n = np.array([(1, 2), (3, 4)], dtype=[('a', int), ('b', float)])
    assert (array_equivalent(m, n, strict_nan=True))
    assert (array_equivalent(m, n, strict_nan=False))

    m = np.array([(1, 2), (3, 4)], dtype=[('a', int), ('b', float)])
    n = np.array([(1, 2), (4, 3)], dtype=[('a', int), ('b', float)])
    assert (not array_equivalent(m, n, strict_nan=True))
    assert (not array_equivalent(m, n, strict_nan=False))

    m = np.array([(1, 2), (3, 4)], dtype=[('a', int), ('b', float)])
    n = np.array([(1, 2), (3, 4)], dtype=[('b', int), ('a', float)])
    assert (not array_equivalent(m, n, strict_nan=True))
    assert (not array_equivalent(m, n, strict_nan=False))


def test_array_equivalent_str():
    for dtype in ['O', 'S', 'U']:
        assert array_equivalent(np.array(['A', 'B'], dtype=dtype),
                                np.array(['A', 'B'], dtype=dtype))
        assert not array_equivalent(np.array(['A', 'B'], dtype=dtype),
                                    np.array(['A', 'X'], dtype=dtype))


def test_na_value_for_dtype():
    for dtype in [np.dtype('M8[ns]'), np.dtype('m8[ns]'),
                  DatetimeTZDtype('datetime64[ns, US/Eastern]')]:
        assert na_value_for_dtype(dtype) is NaT

    for dtype in ['u1', 'u2', 'u4', 'u8',
                  'i1', 'i2', 'i4', 'i8']:
        assert na_value_for_dtype(np.dtype(dtype)) == 0

    for dtype in ['bool']:
        assert na_value_for_dtype(np.dtype(dtype)) is False

    for dtype in ['f2', 'f4', 'f8']:
        assert np.isnan(na_value_for_dtype(np.dtype(dtype)))

    for dtype in ['O']:
        assert np.isnan(na_value_for_dtype(np.dtype(dtype)))
