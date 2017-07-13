# -*- coding: utf-8 -*-

import pytest

from numpy import nan
import numpy as np

from pandas.core.dtypes.common import _ensure_int64
from pandas import Index, isnull
from pandas.util.testing import assert_almost_equal
import pandas.util.testing as tm
from pandas._libs import lib, groupby


def test_series_grouper():
    from pandas import Series
    obj = Series(np.random.randn(10))
    dummy = obj[:0]

    labels = np.array([-1, -1, -1, 0, 0, 0, 1, 1, 1, 1], dtype=np.int64)

    grouper = lib.SeriesGrouper(obj, np.mean, labels, 2, dummy)
    result, counts = grouper.get_result()

    expected = np.array([obj[3:6].mean(), obj[6:].mean()])
    assert_almost_equal(result, expected)

    exp_counts = np.array([3, 4], dtype=np.int64)
    assert_almost_equal(counts, exp_counts)


def test_series_bin_grouper():
    from pandas import Series
    obj = Series(np.random.randn(10))
    dummy = obj[:0]

    bins = np.array([3, 6])

    grouper = lib.SeriesBinGrouper(obj, np.mean, bins, dummy)
    result, counts = grouper.get_result()

    expected = np.array([obj[:3].mean(), obj[3:6].mean(), obj[6:].mean()])
    assert_almost_equal(result, expected)

    exp_counts = np.array([3, 3, 4], dtype=np.int64)
    assert_almost_equal(counts, exp_counts)


class TestBinGroupers(object):

    def setup_method(self, method):
        self.obj = np.random.randn(10, 1)
        self.labels = np.array([0, 0, 0, 1, 1, 1, 2, 2, 2, 2], dtype=np.int64)
        self.bins = np.array([3, 6], dtype=np.int64)

    def test_generate_bins(self):
        from pandas.core.groupby import generate_bins_generic
        values = np.array([1, 2, 3, 4, 5, 6], dtype=np.int64)
        binner = np.array([0, 3, 6, 9], dtype=np.int64)

        for func in [lib.generate_bins_dt64, generate_bins_generic]:
            bins = func(values, binner, closed='left')
            assert ((bins == np.array([2, 5, 6])).all())

            bins = func(values, binner, closed='right')
            assert ((bins == np.array([3, 6, 6])).all())

        for func in [lib.generate_bins_dt64, generate_bins_generic]:
            values = np.array([1, 2, 3, 4, 5, 6], dtype=np.int64)
            binner = np.array([0, 3, 6], dtype=np.int64)

            bins = func(values, binner, closed='right')
            assert ((bins == np.array([3, 6])).all())

        pytest.raises(ValueError, generate_bins_generic, values, [],
                      'right')
        pytest.raises(ValueError, generate_bins_generic, values[:0],
                      binner, 'right')

        pytest.raises(ValueError, generate_bins_generic, values, [4],
                      'right')
        pytest.raises(ValueError, generate_bins_generic, values, [-3, -1],
                      'right')


def test_group_ohlc():
    def _check(dtype):
        obj = np.array(np.random.randn(20), dtype=dtype)

        bins = np.array([6, 12, 20])
        out = np.zeros((3, 4), dtype)
        counts = np.zeros(len(out), dtype=np.int64)
        labels = _ensure_int64(np.repeat(np.arange(3),
                                         np.diff(np.r_[0, bins])))

        func = getattr(groupby, 'group_ohlc_%s' % dtype)
        func(out, counts, obj[:, None], labels)

        def _ohlc(group):
            if isnull(group).all():
                return np.repeat(nan, 4)
            return [group[0], group.max(), group.min(), group[-1]]

        expected = np.array([_ohlc(obj[:6]), _ohlc(obj[6:12]),
                             _ohlc(obj[12:])])

        assert_almost_equal(out, expected)
        tm.assert_numpy_array_equal(counts,
                                    np.array([6, 6, 8], dtype=np.int64))

        obj[:6] = nan
        func(out, counts, obj[:, None], labels)
        expected[0] = nan
        assert_almost_equal(out, expected)

    _check('float32')
    _check('float64')


class TestMoments(object):
    pass


class TestReducer(object):

    def test_int_index(self):
        from pandas.core.series import Series

        arr = np.random.randn(100, 4)
        result = lib.reduce(arr, np.sum, labels=Index(np.arange(4)))
        expected = arr.sum(0)
        assert_almost_equal(result, expected)

        result = lib.reduce(arr, np.sum, axis=1, labels=Index(np.arange(100)))
        expected = arr.sum(1)
        assert_almost_equal(result, expected)

        dummy = Series(0., index=np.arange(100))
        result = lib.reduce(arr, np.sum, dummy=dummy,
                            labels=Index(np.arange(4)))
        expected = arr.sum(0)
        assert_almost_equal(result, expected)

        dummy = Series(0., index=np.arange(4))
        result = lib.reduce(arr, np.sum, axis=1, dummy=dummy,
                            labels=Index(np.arange(100)))
        expected = arr.sum(1)
        assert_almost_equal(result, expected)

        result = lib.reduce(arr, np.sum, axis=1, dummy=dummy,
                            labels=Index(np.arange(100)))
        assert_almost_equal(result, expected)
