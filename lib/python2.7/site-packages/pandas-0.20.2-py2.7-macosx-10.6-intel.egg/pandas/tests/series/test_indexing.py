# coding=utf-8
# pylint: disable-msg=E1101,W0612

import pytest

from datetime import datetime, timedelta

from numpy import nan
import numpy as np
import pandas as pd

import pandas._libs.index as _index
from pandas.core.dtypes.common import is_integer, is_scalar
from pandas import (Index, Series, DataFrame, isnull,
                    date_range, NaT, MultiIndex,
                    Timestamp, DatetimeIndex, Timedelta)
from pandas.core.indexing import IndexingError
from pandas.tseries.offsets import BDay
from pandas._libs import tslib, lib

from pandas.compat import lrange, range
from pandas import compat
from pandas.util.testing import (slow,
                                 assert_series_equal,
                                 assert_almost_equal,
                                 assert_frame_equal)
import pandas.util.testing as tm

from pandas.tests.series.common import TestData

JOIN_TYPES = ['inner', 'outer', 'left', 'right']


class TestSeriesIndexing(TestData):

    def test_get(self):

        # GH 6383
        s = Series(np.array([43, 48, 60, 48, 50, 51, 50, 45, 57, 48, 56, 45,
                             51, 39, 55, 43, 54, 52, 51, 54]))

        result = s.get(25, 0)
        expected = 0
        assert result == expected

        s = Series(np.array([43, 48, 60, 48, 50, 51, 50, 45, 57, 48, 56,
                             45, 51, 39, 55, 43, 54, 52, 51, 54]),
                   index=pd.Float64Index(
                       [25.0, 36.0, 49.0, 64.0, 81.0, 100.0,
                        121.0, 144.0, 169.0, 196.0, 1225.0,
                        1296.0, 1369.0, 1444.0, 1521.0, 1600.0,
                        1681.0, 1764.0, 1849.0, 1936.0],
                       dtype='object'))

        result = s.get(25, 0)
        expected = 43
        assert result == expected

        # GH 7407
        # with a boolean accessor
        df = pd.DataFrame({'i': [0] * 3, 'b': [False] * 3})
        vc = df.i.value_counts()
        result = vc.get(99, default='Missing')
        assert result == 'Missing'

        vc = df.b.value_counts()
        result = vc.get(False, default='Missing')
        assert result == 3

        result = vc.get(True, default='Missing')
        assert result == 'Missing'

    def test_delitem(self):

        # GH 5542
        # should delete the item inplace
        s = Series(lrange(5))
        del s[0]

        expected = Series(lrange(1, 5), index=lrange(1, 5))
        assert_series_equal(s, expected)

        del s[1]
        expected = Series(lrange(2, 5), index=lrange(2, 5))
        assert_series_equal(s, expected)

        # empty
        s = Series()

        def f():
            del s[0]

        pytest.raises(KeyError, f)

        # only 1 left, del, add, del
        s = Series(1)
        del s[0]
        assert_series_equal(s, Series(dtype='int64', index=Index(
            [], dtype='int64')))
        s[0] = 1
        assert_series_equal(s, Series(1))
        del s[0]
        assert_series_equal(s, Series(dtype='int64', index=Index(
            [], dtype='int64')))

        # Index(dtype=object)
        s = Series(1, index=['a'])
        del s['a']
        assert_series_equal(s, Series(dtype='int64', index=Index(
            [], dtype='object')))
        s['a'] = 1
        assert_series_equal(s, Series(1, index=['a']))
        del s['a']
        assert_series_equal(s, Series(dtype='int64', index=Index(
            [], dtype='object')))

    def test_getitem_setitem_ellipsis(self):
        s = Series(np.random.randn(10))

        np.fix(s)

        result = s[...]
        assert_series_equal(result, s)

        s[...] = 5
        assert (result == 5).all()

    def test_getitem_negative_out_of_bounds(self):
        s = Series(tm.rands_array(5, 10), index=tm.rands_array(10, 10))

        pytest.raises(IndexError, s.__getitem__, -11)
        pytest.raises(IndexError, s.__setitem__, -11, 'foo')

    def test_pop(self):
        # GH 6600
        df = DataFrame({'A': 0, 'B': np.arange(5, dtype='int64'), 'C': 0, })
        k = df.iloc[4]

        result = k.pop('B')
        assert result == 4

        expected = Series([0, 0], index=['A', 'C'], name=4)
        assert_series_equal(k, expected)

    def test_getitem_get(self):
        idx1 = self.series.index[5]
        idx2 = self.objSeries.index[5]

        assert self.series[idx1] == self.series.get(idx1)
        assert self.objSeries[idx2] == self.objSeries.get(idx2)

        assert self.series[idx1] == self.series[5]
        assert self.objSeries[idx2] == self.objSeries[5]

        assert self.series.get(-1) == self.series.get(self.series.index[-1])
        assert self.series[5] == self.series.get(self.series.index[5])

        # missing
        d = self.ts.index[0] - BDay()
        pytest.raises(KeyError, self.ts.__getitem__, d)

        # None
        # GH 5652
        for s in [Series(), Series(index=list('abc'))]:
            result = s.get(None)
            assert result is None

    def test_iloc(self):

        s = Series(np.random.randn(10), index=lrange(0, 20, 2))

        for i in range(len(s)):
            result = s.iloc[i]
            exp = s[s.index[i]]
            assert_almost_equal(result, exp)

        # pass a slice
        result = s.iloc[slice(1, 3)]
        expected = s.loc[2:4]
        assert_series_equal(result, expected)

        # test slice is a view
        result[:] = 0
        assert (s[1:3] == 0).all()

        # list of integers
        result = s.iloc[[0, 2, 3, 4, 5]]
        expected = s.reindex(s.index[[0, 2, 3, 4, 5]])
        assert_series_equal(result, expected)

    def test_iloc_nonunique(self):
        s = Series([0, 1, 2], index=[0, 1, 0])
        assert s.iloc[2] == 2

    def test_getitem_regression(self):
        s = Series(lrange(5), index=lrange(5))
        result = s[lrange(5)]
        assert_series_equal(result, s)

    def test_getitem_setitem_slice_bug(self):
        s = Series(lrange(10), lrange(10))
        result = s[-12:]
        assert_series_equal(result, s)

        result = s[-7:]
        assert_series_equal(result, s[3:])

        result = s[:-12]
        assert_series_equal(result, s[:0])

        s = Series(lrange(10), lrange(10))
        s[-12:] = 0
        assert (s == 0).all()

        s[:-12] = 5
        assert (s == 0).all()

    def test_getitem_int64(self):
        idx = np.int64(5)
        assert self.ts[idx] == self.ts[5]

    def test_getitem_fancy(self):
        slice1 = self.series[[1, 2, 3]]
        slice2 = self.objSeries[[1, 2, 3]]
        assert self.series.index[2] == slice1.index[1]
        assert self.objSeries.index[2] == slice2.index[1]
        assert self.series[2] == slice1[1]
        assert self.objSeries[2] == slice2[1]

    def test_getitem_boolean(self):
        s = self.series
        mask = s > s.median()

        # passing list is OK
        result = s[list(mask)]
        expected = s[mask]
        assert_series_equal(result, expected)
        tm.assert_index_equal(result.index, s.index[mask])

    def test_getitem_boolean_empty(self):
        s = Series([], dtype=np.int64)
        s.index.name = 'index_name'
        s = s[s.isnull()]
        assert s.index.name == 'index_name'
        assert s.dtype == np.int64

        # GH5877
        # indexing with empty series
        s = Series(['A', 'B'])
        expected = Series(np.nan, index=['C'], dtype=object)
        result = s[Series(['C'], dtype=object)]
        assert_series_equal(result, expected)

        s = Series(['A', 'B'])
        expected = Series(dtype=object, index=Index([], dtype='int64'))
        result = s[Series([], dtype=object)]
        assert_series_equal(result, expected)

        # invalid because of the boolean indexer
        # that's empty or not-aligned
        def f():
            s[Series([], dtype=bool)]

        pytest.raises(IndexingError, f)

        def f():
            s[Series([True], dtype=bool)]

        pytest.raises(IndexingError, f)

    def test_getitem_generator(self):
        gen = (x > 0 for x in self.series)
        result = self.series[gen]
        result2 = self.series[iter(self.series > 0)]
        expected = self.series[self.series > 0]
        assert_series_equal(result, expected)
        assert_series_equal(result2, expected)

    def test_type_promotion(self):
        # GH12599
        s = pd.Series()
        s["a"] = pd.Timestamp("2016-01-01")
        s["b"] = 3.0
        s["c"] = "foo"
        expected = Series([pd.Timestamp("2016-01-01"), 3.0, "foo"],
                          index=["a", "b", "c"])
        assert_series_equal(s, expected)

    def test_getitem_boolean_object(self):
        # using column from DataFrame

        s = self.series
        mask = s > s.median()
        omask = mask.astype(object)

        # getitem
        result = s[omask]
        expected = s[mask]
        assert_series_equal(result, expected)

        # setitem
        s2 = s.copy()
        cop = s.copy()
        cop[omask] = 5
        s2[mask] = 5
        assert_series_equal(cop, s2)

        # nans raise exception
        omask[5:10] = np.nan
        pytest.raises(Exception, s.__getitem__, omask)
        pytest.raises(Exception, s.__setitem__, omask, 5)

    def test_getitem_setitem_boolean_corner(self):
        ts = self.ts
        mask_shifted = ts.shift(1, freq=BDay()) > ts.median()

        # these used to raise...??

        pytest.raises(Exception, ts.__getitem__, mask_shifted)
        pytest.raises(Exception, ts.__setitem__, mask_shifted, 1)
        # ts[mask_shifted]
        # ts[mask_shifted] = 1

        pytest.raises(Exception, ts.loc.__getitem__, mask_shifted)
        pytest.raises(Exception, ts.loc.__setitem__, mask_shifted, 1)
        # ts.loc[mask_shifted]
        # ts.loc[mask_shifted] = 2

    def test_getitem_setitem_slice_integers(self):
        s = Series(np.random.randn(8), index=[2, 4, 6, 8, 10, 12, 14, 16])

        result = s[:4]
        expected = s.reindex([2, 4, 6, 8])
        assert_series_equal(result, expected)

        s[:4] = 0
        assert (s[:4] == 0).all()
        assert not (s[4:] == 0).any()

    def test_getitem_setitem_datetime_tz_pytz(self):
        tm._skip_if_no_pytz()
        from pytz import timezone as tz

        from pandas import date_range

        N = 50
        # testing with timezone, GH #2785
        rng = date_range('1/1/1990', periods=N, freq='H', tz='US/Eastern')
        ts = Series(np.random.randn(N), index=rng)

        # also test Timestamp tz handling, GH #2789
        result = ts.copy()
        result["1990-01-01 09:00:00+00:00"] = 0
        result["1990-01-01 09:00:00+00:00"] = ts[4]
        assert_series_equal(result, ts)

        result = ts.copy()
        result["1990-01-01 03:00:00-06:00"] = 0
        result["1990-01-01 03:00:00-06:00"] = ts[4]
        assert_series_equal(result, ts)

        # repeat with datetimes
        result = ts.copy()
        result[datetime(1990, 1, 1, 9, tzinfo=tz('UTC'))] = 0
        result[datetime(1990, 1, 1, 9, tzinfo=tz('UTC'))] = ts[4]
        assert_series_equal(result, ts)

        result = ts.copy()

        # comparison dates with datetime MUST be localized!
        date = tz('US/Central').localize(datetime(1990, 1, 1, 3))
        result[date] = 0
        result[date] = ts[4]
        assert_series_equal(result, ts)

    def test_getitem_setitem_datetime_tz_dateutil(self):
        tm._skip_if_no_dateutil()
        from dateutil.tz import tzutc
        from pandas._libs.tslib import _dateutil_gettz as gettz

        tz = lambda x: tzutc() if x == 'UTC' else gettz(
            x)  # handle special case for utc in dateutil

        from pandas import date_range

        N = 50

        # testing with timezone, GH #2785
        rng = date_range('1/1/1990', periods=N, freq='H',
                         tz='America/New_York')
        ts = Series(np.random.randn(N), index=rng)

        # also test Timestamp tz handling, GH #2789
        result = ts.copy()
        result["1990-01-01 09:00:00+00:00"] = 0
        result["1990-01-01 09:00:00+00:00"] = ts[4]
        assert_series_equal(result, ts)

        result = ts.copy()
        result["1990-01-01 03:00:00-06:00"] = 0
        result["1990-01-01 03:00:00-06:00"] = ts[4]
        assert_series_equal(result, ts)

        # repeat with datetimes
        result = ts.copy()
        result[datetime(1990, 1, 1, 9, tzinfo=tz('UTC'))] = 0
        result[datetime(1990, 1, 1, 9, tzinfo=tz('UTC'))] = ts[4]
        assert_series_equal(result, ts)

        result = ts.copy()
        result[datetime(1990, 1, 1, 3, tzinfo=tz('America/Chicago'))] = 0
        result[datetime(1990, 1, 1, 3, tzinfo=tz('America/Chicago'))] = ts[4]
        assert_series_equal(result, ts)

    def test_getitem_setitem_datetimeindex(self):
        N = 50
        # testing with timezone, GH #2785
        rng = date_range('1/1/1990', periods=N, freq='H', tz='US/Eastern')
        ts = Series(np.random.randn(N), index=rng)

        result = ts["1990-01-01 04:00:00"]
        expected = ts[4]
        assert result == expected

        result = ts.copy()
        result["1990-01-01 04:00:00"] = 0
        result["1990-01-01 04:00:00"] = ts[4]
        assert_series_equal(result, ts)

        result = ts["1990-01-01 04:00:00":"1990-01-01 07:00:00"]
        expected = ts[4:8]
        assert_series_equal(result, expected)

        result = ts.copy()
        result["1990-01-01 04:00:00":"1990-01-01 07:00:00"] = 0
        result["1990-01-01 04:00:00":"1990-01-01 07:00:00"] = ts[4:8]
        assert_series_equal(result, ts)

        lb = "1990-01-01 04:00:00"
        rb = "1990-01-01 07:00:00"
        result = ts[(ts.index >= lb) & (ts.index <= rb)]
        expected = ts[4:8]
        assert_series_equal(result, expected)

        # repeat all the above with naive datetimes
        result = ts[datetime(1990, 1, 1, 4)]
        expected = ts[4]
        assert result == expected

        result = ts.copy()
        result[datetime(1990, 1, 1, 4)] = 0
        result[datetime(1990, 1, 1, 4)] = ts[4]
        assert_series_equal(result, ts)

        result = ts[datetime(1990, 1, 1, 4):datetime(1990, 1, 1, 7)]
        expected = ts[4:8]
        assert_series_equal(result, expected)

        result = ts.copy()
        result[datetime(1990, 1, 1, 4):datetime(1990, 1, 1, 7)] = 0
        result[datetime(1990, 1, 1, 4):datetime(1990, 1, 1, 7)] = ts[4:8]
        assert_series_equal(result, ts)

        lb = datetime(1990, 1, 1, 4)
        rb = datetime(1990, 1, 1, 7)
        result = ts[(ts.index >= lb) & (ts.index <= rb)]
        expected = ts[4:8]
        assert_series_equal(result, expected)

        result = ts[ts.index[4]]
        expected = ts[4]
        assert result == expected

        result = ts[ts.index[4:8]]
        expected = ts[4:8]
        assert_series_equal(result, expected)

        result = ts.copy()
        result[ts.index[4:8]] = 0
        result[4:8] = ts[4:8]
        assert_series_equal(result, ts)

        # also test partial date slicing
        result = ts["1990-01-02"]
        expected = ts[24:48]
        assert_series_equal(result, expected)

        result = ts.copy()
        result["1990-01-02"] = 0
        result["1990-01-02"] = ts[24:48]
        assert_series_equal(result, ts)

    def test_getitem_setitem_periodindex(self):
        from pandas import period_range

        N = 50
        rng = period_range('1/1/1990', periods=N, freq='H')
        ts = Series(np.random.randn(N), index=rng)

        result = ts["1990-01-01 04"]
        expected = ts[4]
        assert result == expected

        result = ts.copy()
        result["1990-01-01 04"] = 0
        result["1990-01-01 04"] = ts[4]
        assert_series_equal(result, ts)

        result = ts["1990-01-01 04":"1990-01-01 07"]
        expected = ts[4:8]
        assert_series_equal(result, expected)

        result = ts.copy()
        result["1990-01-01 04":"1990-01-01 07"] = 0
        result["1990-01-01 04":"1990-01-01 07"] = ts[4:8]
        assert_series_equal(result, ts)

        lb = "1990-01-01 04"
        rb = "1990-01-01 07"
        result = ts[(ts.index >= lb) & (ts.index <= rb)]
        expected = ts[4:8]
        assert_series_equal(result, expected)

        # GH 2782
        result = ts[ts.index[4]]
        expected = ts[4]
        assert result == expected

        result = ts[ts.index[4:8]]
        expected = ts[4:8]
        assert_series_equal(result, expected)

        result = ts.copy()
        result[ts.index[4:8]] = 0
        result[4:8] = ts[4:8]
        assert_series_equal(result, ts)

    def test_getitem_median_slice_bug(self):
        index = date_range('20090415', '20090519', freq='2B')
        s = Series(np.random.randn(13), index=index)

        indexer = [slice(6, 7, None)]
        result = s[indexer]
        expected = s[indexer[0]]
        assert_series_equal(result, expected)

    def test_getitem_out_of_bounds(self):
        # don't segfault, GH #495
        pytest.raises(IndexError, self.ts.__getitem__, len(self.ts))

        # GH #917
        s = Series([])
        pytest.raises(IndexError, s.__getitem__, -1)

    def test_getitem_setitem_integers(self):
        # caused bug without test
        s = Series([1, 2, 3], ['a', 'b', 'c'])

        assert s.iloc[0] == s['a']
        s.iloc[0] = 5
        tm.assert_almost_equal(s['a'], 5)

    def test_getitem_box_float64(self):
        value = self.ts[5]
        assert isinstance(value, np.float64)

    def test_getitem_ambiguous_keyerror(self):
        s = Series(lrange(10), index=lrange(0, 20, 2))
        pytest.raises(KeyError, s.__getitem__, 1)
        pytest.raises(KeyError, s.loc.__getitem__, 1)

    def test_getitem_unordered_dup(self):
        obj = Series(lrange(5), index=['c', 'a', 'a', 'b', 'b'])
        assert is_scalar(obj['c'])
        assert obj['c'] == 0

    def test_getitem_dups_with_missing(self):

        # breaks reindex, so need to use .loc internally
        # GH 4246
        s = Series([1, 2, 3, 4], ['foo', 'bar', 'foo', 'bah'])
        expected = s.loc[['foo', 'bar', 'bah', 'bam']]
        result = s[['foo', 'bar', 'bah', 'bam']]
        assert_series_equal(result, expected)

    def test_getitem_dups(self):
        s = Series(range(5), index=['A', 'A', 'B', 'C', 'C'], dtype=np.int64)
        expected = Series([3, 4], index=['C', 'C'], dtype=np.int64)
        result = s['C']
        assert_series_equal(result, expected)

    def test_getitem_dataframe(self):
        rng = list(range(10))
        s = pd.Series(10, index=rng)
        df = pd.DataFrame(rng, index=rng)
        pytest.raises(TypeError, s.__getitem__, df > 5)

    def test_getitem_callable(self):
        # GH 12533
        s = pd.Series(4, index=list('ABCD'))
        result = s[lambda x: 'A']
        assert result == s.loc['A']

        result = s[lambda x: ['A', 'B']]
        tm.assert_series_equal(result, s.loc[['A', 'B']])

        result = s[lambda x: [True, False, True, True]]
        tm.assert_series_equal(result, s.iloc[[0, 2, 3]])

    def test_setitem_ambiguous_keyerror(self):
        s = Series(lrange(10), index=lrange(0, 20, 2))

        # equivalent of an append
        s2 = s.copy()
        s2[1] = 5
        expected = s.append(Series([5], index=[1]))
        assert_series_equal(s2, expected)

        s2 = s.copy()
        s2.loc[1] = 5
        expected = s.append(Series([5], index=[1]))
        assert_series_equal(s2, expected)

    def test_setitem_float_labels(self):
        # note labels are floats
        s = Series(['a', 'b', 'c'], index=[0, 0.5, 1])
        tmp = s.copy()

        s.loc[1] = 'zoo'
        tmp.iloc[2] = 'zoo'

        assert_series_equal(s, tmp)

    def test_setitem_callable(self):
        # GH 12533
        s = pd.Series([1, 2, 3, 4], index=list('ABCD'))
        s[lambda x: 'A'] = -1
        tm.assert_series_equal(s, pd.Series([-1, 2, 3, 4], index=list('ABCD')))

    def test_setitem_other_callable(self):
        # GH 13299
        inc = lambda x: x + 1

        s = pd.Series([1, 2, -1, 4])
        s[s < 0] = inc

        expected = pd.Series([1, 2, inc, 4])
        tm.assert_series_equal(s, expected)

    def test_slice(self):
        numSlice = self.series[10:20]
        numSliceEnd = self.series[-10:]
        objSlice = self.objSeries[10:20]

        assert self.series.index[9] not in numSlice.index
        assert self.objSeries.index[9] not in objSlice.index

        assert len(numSlice) == len(numSlice.index)
        assert self.series[numSlice.index[0]] == numSlice[numSlice.index[0]]

        assert numSlice.index[1] == self.series.index[11]
        assert tm.equalContents(numSliceEnd, np.array(self.series)[-10:])

        # Test return view.
        sl = self.series[10:20]
        sl[:] = 0

        assert (self.series[10:20] == 0).all()

    def test_slice_can_reorder_not_uniquely_indexed(self):
        s = Series(1, index=['a', 'a', 'b', 'b', 'c'])
        s[::-1]  # it works!

    def test_slice_float_get_set(self):

        pytest.raises(TypeError, lambda: self.ts[4.0:10.0])

        def f():
            self.ts[4.0:10.0] = 0

        pytest.raises(TypeError, f)

        pytest.raises(TypeError, self.ts.__getitem__, slice(4.5, 10.0))
        pytest.raises(TypeError, self.ts.__setitem__, slice(4.5, 10.0), 0)

    def test_slice_floats2(self):
        s = Series(np.random.rand(10), index=np.arange(10, 20, dtype=float))

        assert len(s.loc[12.0:]) == 8
        assert len(s.loc[12.5:]) == 7

        i = np.arange(10, 20, dtype=float)
        i[2] = 12.2
        s.index = i
        assert len(s.loc[12.0:]) == 8
        assert len(s.loc[12.5:]) == 7

    def test_slice_float64(self):

        values = np.arange(10., 50., 2)
        index = Index(values)

        start, end = values[[5, 15]]

        s = Series(np.random.randn(20), index=index)

        result = s[start:end]
        expected = s.iloc[5:16]
        assert_series_equal(result, expected)

        result = s.loc[start:end]
        assert_series_equal(result, expected)

        df = DataFrame(np.random.randn(20, 3), index=index)

        result = df[start:end]
        expected = df.iloc[5:16]
        tm.assert_frame_equal(result, expected)

        result = df.loc[start:end]
        tm.assert_frame_equal(result, expected)

    def test_setitem(self):
        self.ts[self.ts.index[5]] = np.NaN
        self.ts[[1, 2, 17]] = np.NaN
        self.ts[6] = np.NaN
        assert np.isnan(self.ts[6])
        assert np.isnan(self.ts[2])
        self.ts[np.isnan(self.ts)] = 5
        assert not np.isnan(self.ts[2])

        # caught this bug when writing tests
        series = Series(tm.makeIntIndex(20).astype(float),
                        index=tm.makeIntIndex(20))

        series[::2] = 0
        assert (series[::2] == 0).all()

        # set item that's not contained
        s = self.series.copy()
        s['foobar'] = 1

        app = Series([1], index=['foobar'], name='series')
        expected = self.series.append(app)
        assert_series_equal(s, expected)

        # Test for issue #10193
        key = pd.Timestamp('2012-01-01')
        series = pd.Series()
        series[key] = 47
        expected = pd.Series(47, [key])
        assert_series_equal(series, expected)

        series = pd.Series([], pd.DatetimeIndex([], freq='D'))
        series[key] = 47
        expected = pd.Series(47, pd.DatetimeIndex([key], freq='D'))
        assert_series_equal(series, expected)

    def test_setitem_dtypes(self):

        # change dtypes
        # GH 4463
        expected = Series([np.nan, 2, 3])

        s = Series([1, 2, 3])
        s.iloc[0] = np.nan
        assert_series_equal(s, expected)

        s = Series([1, 2, 3])
        s.loc[0] = np.nan
        assert_series_equal(s, expected)

        s = Series([1, 2, 3])
        s[0] = np.nan
        assert_series_equal(s, expected)

        s = Series([False])
        s.loc[0] = np.nan
        assert_series_equal(s, Series([np.nan]))

        s = Series([False, True])
        s.loc[0] = np.nan
        assert_series_equal(s, Series([np.nan, 1.0]))

    def test_set_value(self):
        idx = self.ts.index[10]
        res = self.ts.set_value(idx, 0)
        assert res is self.ts
        assert self.ts[idx] == 0

        # equiv
        s = self.series.copy()
        res = s.set_value('foobar', 0)
        assert res is s
        assert res.index[-1] == 'foobar'
        assert res['foobar'] == 0

        s = self.series.copy()
        s.loc['foobar'] = 0
        assert s.index[-1] == 'foobar'
        assert s['foobar'] == 0

    def test_setslice(self):
        sl = self.ts[5:20]
        assert len(sl) == len(sl.index)
        assert sl.index.is_unique

    def test_basic_getitem_setitem_corner(self):
        # invalid tuples, e.g. self.ts[:, None] vs. self.ts[:, 2]
        with tm.assert_raises_regex(ValueError, 'tuple-index'):
            self.ts[:, 2]
        with tm.assert_raises_regex(ValueError, 'tuple-index'):
            self.ts[:, 2] = 2

        # weird lists. [slice(0, 5)] will work but not two slices
        result = self.ts[[slice(None, 5)]]
        expected = self.ts[:5]
        assert_series_equal(result, expected)

        # OK
        pytest.raises(Exception, self.ts.__getitem__,
                      [5, slice(None, None)])
        pytest.raises(Exception, self.ts.__setitem__,
                      [5, slice(None, None)], 2)

    def test_basic_getitem_with_labels(self):
        indices = self.ts.index[[5, 10, 15]]

        result = self.ts[indices]
        expected = self.ts.reindex(indices)
        assert_series_equal(result, expected)

        result = self.ts[indices[0]:indices[2]]
        expected = self.ts.loc[indices[0]:indices[2]]
        assert_series_equal(result, expected)

        # integer indexes, be careful
        s = Series(np.random.randn(10), index=lrange(0, 20, 2))
        inds = [0, 2, 5, 7, 8]
        arr_inds = np.array([0, 2, 5, 7, 8])
        result = s[inds]
        expected = s.reindex(inds)
        assert_series_equal(result, expected)

        result = s[arr_inds]
        expected = s.reindex(arr_inds)
        assert_series_equal(result, expected)

        # GH12089
        # with tz for values
        s = Series(pd.date_range("2011-01-01", periods=3, tz="US/Eastern"),
                   index=['a', 'b', 'c'])
        expected = Timestamp('2011-01-01', tz='US/Eastern')
        result = s.loc['a']
        assert result == expected
        result = s.iloc[0]
        assert result == expected
        result = s['a']
        assert result == expected

    def test_basic_setitem_with_labels(self):
        indices = self.ts.index[[5, 10, 15]]

        cp = self.ts.copy()
        exp = self.ts.copy()
        cp[indices] = 0
        exp.loc[indices] = 0
        assert_series_equal(cp, exp)

        cp = self.ts.copy()
        exp = self.ts.copy()
        cp[indices[0]:indices[2]] = 0
        exp.loc[indices[0]:indices[2]] = 0
        assert_series_equal(cp, exp)

        # integer indexes, be careful
        s = Series(np.random.randn(10), index=lrange(0, 20, 2))
        inds = [0, 4, 6]
        arr_inds = np.array([0, 4, 6])

        cp = s.copy()
        exp = s.copy()
        s[inds] = 0
        s.loc[inds] = 0
        assert_series_equal(cp, exp)

        cp = s.copy()
        exp = s.copy()
        s[arr_inds] = 0
        s.loc[arr_inds] = 0
        assert_series_equal(cp, exp)

        inds_notfound = [0, 4, 5, 6]
        arr_inds_notfound = np.array([0, 4, 5, 6])
        pytest.raises(Exception, s.__setitem__, inds_notfound, 0)
        pytest.raises(Exception, s.__setitem__, arr_inds_notfound, 0)

        # GH12089
        # with tz for values
        s = Series(pd.date_range("2011-01-01", periods=3, tz="US/Eastern"),
                   index=['a', 'b', 'c'])
        s2 = s.copy()
        expected = Timestamp('2011-01-03', tz='US/Eastern')
        s2.loc['a'] = expected
        result = s2.loc['a']
        assert result == expected

        s2 = s.copy()
        s2.iloc[0] = expected
        result = s2.iloc[0]
        assert result == expected

        s2 = s.copy()
        s2['a'] = expected
        result = s2['a']
        assert result == expected

    def test_loc_getitem(self):
        inds = self.series.index[[3, 4, 7]]
        assert_series_equal(self.series.loc[inds], self.series.reindex(inds))
        assert_series_equal(self.series.iloc[5::2], self.series[5::2])

        # slice with indices
        d1, d2 = self.ts.index[[5, 15]]
        result = self.ts.loc[d1:d2]
        expected = self.ts.truncate(d1, d2)
        assert_series_equal(result, expected)

        # boolean
        mask = self.series > self.series.median()
        assert_series_equal(self.series.loc[mask], self.series[mask])

        # ask for index value
        assert self.ts.loc[d1] == self.ts[d1]
        assert self.ts.loc[d2] == self.ts[d2]

    def test_loc_getitem_not_monotonic(self):
        d1, d2 = self.ts.index[[5, 15]]

        ts2 = self.ts[::2][[1, 2, 0]]

        pytest.raises(KeyError, ts2.loc.__getitem__, slice(d1, d2))
        pytest.raises(KeyError, ts2.loc.__setitem__, slice(d1, d2), 0)

    def test_loc_getitem_setitem_integer_slice_keyerrors(self):
        s = Series(np.random.randn(10), index=lrange(0, 20, 2))

        # this is OK
        cp = s.copy()
        cp.iloc[4:10] = 0
        assert (cp.iloc[4:10] == 0).all()

        # so is this
        cp = s.copy()
        cp.iloc[3:11] = 0
        assert (cp.iloc[3:11] == 0).values.all()

        result = s.iloc[2:6]
        result2 = s.loc[3:11]
        expected = s.reindex([4, 6, 8, 10])

        assert_series_equal(result, expected)
        assert_series_equal(result2, expected)

        # non-monotonic, raise KeyError
        s2 = s.iloc[lrange(5) + lrange(5, 10)[::-1]]
        pytest.raises(KeyError, s2.loc.__getitem__, slice(3, 11))
        pytest.raises(KeyError, s2.loc.__setitem__, slice(3, 11), 0)

    def test_loc_getitem_iterator(self):
        idx = iter(self.series.index[:10])
        result = self.series.loc[idx]
        assert_series_equal(result, self.series[:10])

    def test_setitem_with_tz(self):
        for tz in ['US/Eastern', 'UTC', 'Asia/Tokyo']:
            orig = pd.Series(pd.date_range('2016-01-01', freq='H', periods=3,
                                           tz=tz))
            assert orig.dtype == 'datetime64[ns, {0}]'.format(tz)

            # scalar
            s = orig.copy()
            s[1] = pd.Timestamp('2011-01-01', tz=tz)
            exp = pd.Series([pd.Timestamp('2016-01-01 00:00', tz=tz),
                             pd.Timestamp('2011-01-01 00:00', tz=tz),
                             pd.Timestamp('2016-01-01 02:00', tz=tz)])
            tm.assert_series_equal(s, exp)

            s = orig.copy()
            s.loc[1] = pd.Timestamp('2011-01-01', tz=tz)
            tm.assert_series_equal(s, exp)

            s = orig.copy()
            s.iloc[1] = pd.Timestamp('2011-01-01', tz=tz)
            tm.assert_series_equal(s, exp)

            # vector
            vals = pd.Series([pd.Timestamp('2011-01-01', tz=tz),
                              pd.Timestamp('2012-01-01', tz=tz)], index=[1, 2])
            assert vals.dtype == 'datetime64[ns, {0}]'.format(tz)

            s[[1, 2]] = vals
            exp = pd.Series([pd.Timestamp('2016-01-01 00:00', tz=tz),
                             pd.Timestamp('2011-01-01 00:00', tz=tz),
                             pd.Timestamp('2012-01-01 00:00', tz=tz)])
            tm.assert_series_equal(s, exp)

            s = orig.copy()
            s.loc[[1, 2]] = vals
            tm.assert_series_equal(s, exp)

            s = orig.copy()
            s.iloc[[1, 2]] = vals
            tm.assert_series_equal(s, exp)

    def test_setitem_with_tz_dst(self):
        # GH XXX
        tz = 'US/Eastern'
        orig = pd.Series(pd.date_range('2016-11-06', freq='H', periods=3,
                                       tz=tz))
        assert orig.dtype == 'datetime64[ns, {0}]'.format(tz)

        # scalar
        s = orig.copy()
        s[1] = pd.Timestamp('2011-01-01', tz=tz)
        exp = pd.Series([pd.Timestamp('2016-11-06 00:00-04:00', tz=tz),
                         pd.Timestamp('2011-01-01 00:00-05:00', tz=tz),
                         pd.Timestamp('2016-11-06 01:00-05:00', tz=tz)])
        tm.assert_series_equal(s, exp)

        s = orig.copy()
        s.loc[1] = pd.Timestamp('2011-01-01', tz=tz)
        tm.assert_series_equal(s, exp)

        s = orig.copy()
        s.iloc[1] = pd.Timestamp('2011-01-01', tz=tz)
        tm.assert_series_equal(s, exp)

        # vector
        vals = pd.Series([pd.Timestamp('2011-01-01', tz=tz),
                          pd.Timestamp('2012-01-01', tz=tz)], index=[1, 2])
        assert vals.dtype == 'datetime64[ns, {0}]'.format(tz)

        s[[1, 2]] = vals
        exp = pd.Series([pd.Timestamp('2016-11-06 00:00', tz=tz),
                         pd.Timestamp('2011-01-01 00:00', tz=tz),
                         pd.Timestamp('2012-01-01 00:00', tz=tz)])
        tm.assert_series_equal(s, exp)

        s = orig.copy()
        s.loc[[1, 2]] = vals
        tm.assert_series_equal(s, exp)

        s = orig.copy()
        s.iloc[[1, 2]] = vals
        tm.assert_series_equal(s, exp)

    def test_where(self):
        s = Series(np.random.randn(5))
        cond = s > 0

        rs = s.where(cond).dropna()
        rs2 = s[cond]
        assert_series_equal(rs, rs2)

        rs = s.where(cond, -s)
        assert_series_equal(rs, s.abs())

        rs = s.where(cond)
        assert (s.shape == rs.shape)
        assert (rs is not s)

        # test alignment
        cond = Series([True, False, False, True, False], index=s.index)
        s2 = -(s.abs())

        expected = s2[cond].reindex(s2.index[:3]).reindex(s2.index)
        rs = s2.where(cond[:3])
        assert_series_equal(rs, expected)

        expected = s2.abs()
        expected.iloc[0] = s2[0]
        rs = s2.where(cond[:3], -s2)
        assert_series_equal(rs, expected)

        pytest.raises(ValueError, s.where, 1)
        pytest.raises(ValueError, s.where, cond[:3].values, -s)

        # GH 2745
        s = Series([1, 2])
        s[[True, False]] = [0, 1]
        expected = Series([0, 2])
        assert_series_equal(s, expected)

        # failures
        pytest.raises(ValueError, s.__setitem__, tuple([[[True, False]]]),
                      [0, 2, 3])
        pytest.raises(ValueError, s.__setitem__, tuple([[[True, False]]]),
                      [])

        # unsafe dtype changes
        for dtype in [np.int8, np.int16, np.int32, np.int64, np.float16,
                      np.float32, np.float64]:
            s = Series(np.arange(10), dtype=dtype)
            mask = s < 5
            s[mask] = lrange(2, 7)
            expected = Series(lrange(2, 7) + lrange(5, 10), dtype=dtype)
            assert_series_equal(s, expected)
            assert s.dtype == expected.dtype

        # these are allowed operations, but are upcasted
        for dtype in [np.int64, np.float64]:
            s = Series(np.arange(10), dtype=dtype)
            mask = s < 5
            values = [2.5, 3.5, 4.5, 5.5, 6.5]
            s[mask] = values
            expected = Series(values + lrange(5, 10), dtype='float64')
            assert_series_equal(s, expected)
            assert s.dtype == expected.dtype

        # GH 9731
        s = Series(np.arange(10), dtype='int64')
        mask = s > 5
        values = [2.5, 3.5, 4.5, 5.5]
        s[mask] = values
        expected = Series(lrange(6) + values, dtype='float64')
        assert_series_equal(s, expected)

        # can't do these as we are forced to change the itemsize of the input
        # to something we cannot
        for dtype in [np.int8, np.int16, np.int32, np.float16, np.float32]:
            s = Series(np.arange(10), dtype=dtype)
            mask = s < 5
            values = [2.5, 3.5, 4.5, 5.5, 6.5]
            pytest.raises(Exception, s.__setitem__, tuple(mask), values)

        # GH3235
        s = Series(np.arange(10), dtype='int64')
        mask = s < 5
        s[mask] = lrange(2, 7)
        expected = Series(lrange(2, 7) + lrange(5, 10), dtype='int64')
        assert_series_equal(s, expected)
        assert s.dtype == expected.dtype

        s = Series(np.arange(10), dtype='int64')
        mask = s > 5
        s[mask] = [0] * 4
        expected = Series([0, 1, 2, 3, 4, 5] + [0] * 4, dtype='int64')
        assert_series_equal(s, expected)

        s = Series(np.arange(10))
        mask = s > 5

        def f():
            s[mask] = [5, 4, 3, 2, 1]

        pytest.raises(ValueError, f)

        def f():
            s[mask] = [0] * 5

        pytest.raises(ValueError, f)

        # dtype changes
        s = Series([1, 2, 3, 4])
        result = s.where(s > 2, np.nan)
        expected = Series([np.nan, np.nan, 3, 4])
        assert_series_equal(result, expected)

        # GH 4667
        # setting with None changes dtype
        s = Series(range(10)).astype(float)
        s[8] = None
        result = s[8]
        assert isnull(result)

        s = Series(range(10)).astype(float)
        s[s > 8] = None
        result = s[isnull(s)]
        expected = Series(np.nan, index=[9])
        assert_series_equal(result, expected)

    def test_where_array_like(self):
        # see gh-15414
        s = Series([1, 2, 3])
        cond = [False, True, True]
        expected = Series([np.nan, 2, 3])
        klasses = [list, tuple, np.array, Series]

        for klass in klasses:
            result = s.where(klass(cond))
            assert_series_equal(result, expected)

    def test_where_invalid_input(self):
        # see gh-15414: only boolean arrays accepted
        s = Series([1, 2, 3])
        msg = "Boolean array expected for the condition"

        conds = [
            [1, 0, 1],
            Series([2, 5, 7]),
            ["True", "False", "True"],
            [Timestamp("2017-01-01"),
             pd.NaT, Timestamp("2017-01-02")]
        ]

        for cond in conds:
            with tm.assert_raises_regex(ValueError, msg):
                s.where(cond)

        msg = "Array conditional must be same shape as self"
        with tm.assert_raises_regex(ValueError, msg):
            s.where([True])

    def test_where_ndframe_align(self):
        msg = "Array conditional must be same shape as self"
        s = Series([1, 2, 3])

        cond = [True]
        with tm.assert_raises_regex(ValueError, msg):
            s.where(cond)

        expected = Series([1, np.nan, np.nan])

        out = s.where(Series(cond))
        tm.assert_series_equal(out, expected)

        cond = np.array([False, True, False, True])
        with tm.assert_raises_regex(ValueError, msg):
            s.where(cond)

        expected = Series([np.nan, 2, np.nan])

        out = s.where(Series(cond))
        tm.assert_series_equal(out, expected)

    def test_where_setitem_invalid(self):

        # GH 2702
        # make sure correct exceptions are raised on invalid list assignment

        # slice
        s = Series(list('abc'))

        def f():
            s[0:3] = list(range(27))

        pytest.raises(ValueError, f)

        s[0:3] = list(range(3))
        expected = Series([0, 1, 2])
        assert_series_equal(s.astype(np.int64), expected, )

        # slice with step
        s = Series(list('abcdef'))

        def f():
            s[0:4:2] = list(range(27))

        pytest.raises(ValueError, f)

        s = Series(list('abcdef'))
        s[0:4:2] = list(range(2))
        expected = Series([0, 'b', 1, 'd', 'e', 'f'])
        assert_series_equal(s, expected)

        # neg slices
        s = Series(list('abcdef'))

        def f():
            s[:-1] = list(range(27))

        pytest.raises(ValueError, f)

        s[-3:-1] = list(range(2))
        expected = Series(['a', 'b', 'c', 0, 1, 'f'])
        assert_series_equal(s, expected)

        # list
        s = Series(list('abc'))

        def f():
            s[[0, 1, 2]] = list(range(27))

        pytest.raises(ValueError, f)

        s = Series(list('abc'))

        def f():
            s[[0, 1, 2]] = list(range(2))

        pytest.raises(ValueError, f)

        # scalar
        s = Series(list('abc'))
        s[0] = list(range(10))
        expected = Series([list(range(10)), 'b', 'c'])
        assert_series_equal(s, expected)

    def test_where_broadcast(self):
        # Test a variety of differently sized series
        for size in range(2, 6):
            # Test a variety of boolean indices
            for selection in [
                    # First element should be set
                    np.resize([True, False, False, False, False], size),
                    # Set alternating elements]
                    np.resize([True, False], size),
                    # No element should be set
                    np.resize([False], size)]:

                # Test a variety of different numbers as content
                for item in [2.0, np.nan, np.finfo(np.float).max,
                             np.finfo(np.float).min]:
                    # Test numpy arrays, lists and tuples as the input to be
                    # broadcast
                    for arr in [np.array([item]), [item], (item, )]:
                        data = np.arange(size, dtype=float)
                        s = Series(data)
                        s[selection] = arr
                        # Construct the expected series by taking the source
                        # data or item based on the selection
                        expected = Series([item if use_item else data[
                            i] for i, use_item in enumerate(selection)])
                        assert_series_equal(s, expected)

                        s = Series(data)
                        result = s.where(~selection, arr)
                        assert_series_equal(result, expected)

    def test_where_inplace(self):
        s = Series(np.random.randn(5))
        cond = s > 0

        rs = s.copy()

        rs.where(cond, inplace=True)
        assert_series_equal(rs.dropna(), s[cond])
        assert_series_equal(rs, s.where(cond))

        rs = s.copy()
        rs.where(cond, -s, inplace=True)
        assert_series_equal(rs, s.where(cond, -s))

    def test_where_dups(self):
        # GH 4550
        # where crashes with dups in index
        s1 = Series(list(range(3)))
        s2 = Series(list(range(3)))
        comb = pd.concat([s1, s2])
        result = comb.where(comb < 2)
        expected = Series([0, 1, np.nan, 0, 1, np.nan],
                          index=[0, 1, 2, 0, 1, 2])
        assert_series_equal(result, expected)

        # GH 4548
        # inplace updating not working with dups
        comb[comb < 1] = 5
        expected = Series([5, 1, 2, 5, 1, 2], index=[0, 1, 2, 0, 1, 2])
        assert_series_equal(comb, expected)

        comb[comb < 2] += 10
        expected = Series([5, 11, 2, 5, 11, 2], index=[0, 1, 2, 0, 1, 2])
        assert_series_equal(comb, expected)

    def test_where_datetime(self):
        s = Series(date_range('20130102', periods=2))
        expected = Series([10, 10], dtype='datetime64[ns]')
        mask = np.array([False, False])

        rs = s.where(mask, [10, 10])
        assert_series_equal(rs, expected)

        rs = s.where(mask, 10)
        assert_series_equal(rs, expected)

        rs = s.where(mask, 10.0)
        assert_series_equal(rs, expected)

        rs = s.where(mask, [10.0, 10.0])
        assert_series_equal(rs, expected)

        rs = s.where(mask, [10.0, np.nan])
        expected = Series([10, None], dtype='datetime64[ns]')
        assert_series_equal(rs, expected)

        # GH 15701
        timestamps = ['2016-12-31 12:00:04+00:00',
                      '2016-12-31 12:00:04.010000+00:00']
        s = Series([pd.Timestamp(t) for t in timestamps])
        rs = s.where(Series([False, True]))
        expected = Series([pd.NaT, s[1]])
        assert_series_equal(rs, expected)

    def test_where_timedelta(self):
        s = Series([1, 2], dtype='timedelta64[ns]')
        expected = Series([10, 10], dtype='timedelta64[ns]')
        mask = np.array([False, False])

        rs = s.where(mask, [10, 10])
        assert_series_equal(rs, expected)

        rs = s.where(mask, 10)
        assert_series_equal(rs, expected)

        rs = s.where(mask, 10.0)
        assert_series_equal(rs, expected)

        rs = s.where(mask, [10.0, 10.0])
        assert_series_equal(rs, expected)

        rs = s.where(mask, [10.0, np.nan])
        expected = Series([10, None], dtype='timedelta64[ns]')
        assert_series_equal(rs, expected)

    def test_mask(self):
        # compare with tested results in test_where
        s = Series(np.random.randn(5))
        cond = s > 0

        rs = s.where(~cond, np.nan)
        assert_series_equal(rs, s.mask(cond))

        rs = s.where(~cond)
        rs2 = s.mask(cond)
        assert_series_equal(rs, rs2)

        rs = s.where(~cond, -s)
        rs2 = s.mask(cond, -s)
        assert_series_equal(rs, rs2)

        cond = Series([True, False, False, True, False], index=s.index)
        s2 = -(s.abs())
        rs = s2.where(~cond[:3])
        rs2 = s2.mask(cond[:3])
        assert_series_equal(rs, rs2)

        rs = s2.where(~cond[:3], -s2)
        rs2 = s2.mask(cond[:3], -s2)
        assert_series_equal(rs, rs2)

        pytest.raises(ValueError, s.mask, 1)
        pytest.raises(ValueError, s.mask, cond[:3].values, -s)

        # dtype changes
        s = Series([1, 2, 3, 4])
        result = s.mask(s > 2, np.nan)
        expected = Series([1, 2, np.nan, np.nan])
        assert_series_equal(result, expected)

    def test_mask_broadcast(self):
        # GH 8801
        # copied from test_where_broadcast
        for size in range(2, 6):
            for selection in [
                    # First element should be set
                    np.resize([True, False, False, False, False], size),
                    # Set alternating elements]
                    np.resize([True, False], size),
                    # No element should be set
                    np.resize([False], size)]:
                for item in [2.0, np.nan, np.finfo(np.float).max,
                             np.finfo(np.float).min]:
                    for arr in [np.array([item]), [item], (item, )]:
                        data = np.arange(size, dtype=float)
                        s = Series(data)
                        result = s.mask(selection, arr)
                        expected = Series([item if use_item else data[
                            i] for i, use_item in enumerate(selection)])
                        assert_series_equal(result, expected)

    def test_mask_inplace(self):
        s = Series(np.random.randn(5))
        cond = s > 0

        rs = s.copy()
        rs.mask(cond, inplace=True)
        assert_series_equal(rs.dropna(), s[~cond])
        assert_series_equal(rs, s.mask(cond))

        rs = s.copy()
        rs.mask(cond, -s, inplace=True)
        assert_series_equal(rs, s.mask(cond, -s))

    def test_ix_setitem(self):
        inds = self.series.index[[3, 4, 7]]

        result = self.series.copy()
        result.loc[inds] = 5

        expected = self.series.copy()
        expected[[3, 4, 7]] = 5
        assert_series_equal(result, expected)

        result.iloc[5:10] = 10
        expected[5:10] = 10
        assert_series_equal(result, expected)

        # set slice with indices
        d1, d2 = self.series.index[[5, 15]]
        result.loc[d1:d2] = 6
        expected[5:16] = 6  # because it's inclusive
        assert_series_equal(result, expected)

        # set index value
        self.series.loc[d1] = 4
        self.series.loc[d2] = 6
        assert self.series[d1] == 4
        assert self.series[d2] == 6

    def test_where_numeric_with_string(self):
        # GH 9280
        s = pd.Series([1, 2, 3])
        w = s.where(s > 1, 'X')

        assert not is_integer(w[0])
        assert is_integer(w[1])
        assert is_integer(w[2])
        assert isinstance(w[0], str)
        assert w.dtype == 'object'

        w = s.where(s > 1, ['X', 'Y', 'Z'])
        assert not is_integer(w[0])
        assert is_integer(w[1])
        assert is_integer(w[2])
        assert isinstance(w[0], str)
        assert w.dtype == 'object'

        w = s.where(s > 1, np.array(['X', 'Y', 'Z']))
        assert not is_integer(w[0])
        assert is_integer(w[1])
        assert is_integer(w[2])
        assert isinstance(w[0], str)
        assert w.dtype == 'object'

    def test_setitem_boolean(self):
        mask = self.series > self.series.median()

        # similiar indexed series
        result = self.series.copy()
        result[mask] = self.series * 2
        expected = self.series * 2
        assert_series_equal(result[mask], expected[mask])

        # needs alignment
        result = self.series.copy()
        result[mask] = (self.series * 2)[0:5]
        expected = (self.series * 2)[0:5].reindex_like(self.series)
        expected[-mask] = self.series[mask]
        assert_series_equal(result[mask], expected[mask])

    def test_ix_setitem_boolean(self):
        mask = self.series > self.series.median()

        result = self.series.copy()
        result.loc[mask] = 0
        expected = self.series
        expected[mask] = 0
        assert_series_equal(result, expected)

    def test_ix_setitem_corner(self):
        inds = list(self.series.index[[5, 8, 12]])
        self.series.loc[inds] = 5
        pytest.raises(Exception, self.series.loc.__setitem__,
                      inds + ['foo'], 5)

    def test_get_set_boolean_different_order(self):
        ordered = self.series.sort_values()

        # setting
        copy = self.series.copy()
        copy[ordered > 0] = 0

        expected = self.series.copy()
        expected[expected > 0] = 0

        assert_series_equal(copy, expected)

        # getting
        sel = self.series[ordered > 0]
        exp = self.series[self.series > 0]
        assert_series_equal(sel, exp)

    def test_setitem_na(self):
        # these induce dtype changes
        expected = Series([np.nan, 3, np.nan, 5, np.nan, 7, np.nan, 9, np.nan])
        s = Series([2, 3, 4, 5, 6, 7, 8, 9, 10])
        s[::2] = np.nan
        assert_series_equal(s, expected)

        # get's coerced to float, right?
        expected = Series([np.nan, 1, np.nan, 0])
        s = Series([True, True, False, False])
        s[::2] = np.nan
        assert_series_equal(s, expected)

        expected = Series([np.nan, np.nan, np.nan, np.nan, np.nan, 5, 6, 7, 8,
                           9])
        s = Series(np.arange(10))
        s[:5] = np.nan
        assert_series_equal(s, expected)

    def test_basic_indexing(self):
        s = Series(np.random.randn(5), index=['a', 'b', 'a', 'a', 'b'])

        pytest.raises(IndexError, s.__getitem__, 5)
        pytest.raises(IndexError, s.__setitem__, 5, 0)

        pytest.raises(KeyError, s.__getitem__, 'c')

        s = s.sort_index()

        pytest.raises(IndexError, s.__getitem__, 5)
        pytest.raises(IndexError, s.__setitem__, 5, 0)

    def test_int_indexing(self):
        s = Series(np.random.randn(6), index=[0, 0, 1, 1, 2, 2])

        pytest.raises(KeyError, s.__getitem__, 5)

        pytest.raises(KeyError, s.__getitem__, 'c')

        # not monotonic
        s = Series(np.random.randn(6), index=[2, 2, 0, 0, 1, 1])

        pytest.raises(KeyError, s.__getitem__, 5)

        pytest.raises(KeyError, s.__getitem__, 'c')

    def test_datetime_indexing(self):
        from pandas import date_range

        index = date_range('1/1/2000', '1/7/2000')
        index = index.repeat(3)

        s = Series(len(index), index=index)
        stamp = Timestamp('1/8/2000')

        pytest.raises(KeyError, s.__getitem__, stamp)
        s[stamp] = 0
        assert s[stamp] == 0

        # not monotonic
        s = Series(len(index), index=index)
        s = s[::-1]

        pytest.raises(KeyError, s.__getitem__, stamp)
        s[stamp] = 0
        assert s[stamp] == 0

    def test_timedelta_assignment(self):
        # GH 8209
        s = Series([])
        s.loc['B'] = timedelta(1)
        tm.assert_series_equal(s, Series(Timedelta('1 days'), index=['B']))

        s = s.reindex(s.index.insert(0, 'A'))
        tm.assert_series_equal(s, Series(
            [np.nan, Timedelta('1 days')], index=['A', 'B']))

        result = s.fillna(timedelta(1))
        expected = Series(Timedelta('1 days'), index=['A', 'B'])
        tm.assert_series_equal(result, expected)

        s.loc['A'] = timedelta(1)
        tm.assert_series_equal(s, expected)

        # GH 14155
        s = Series(10 * [np.timedelta64(10, 'm')])
        s.loc[[1, 2, 3]] = np.timedelta64(20, 'm')
        expected = pd.Series(10 * [np.timedelta64(10, 'm')])
        expected.loc[[1, 2, 3]] = pd.Timedelta(np.timedelta64(20, 'm'))
        tm.assert_series_equal(s, expected)

    def test_underlying_data_conversion(self):

        # GH 4080
        df = DataFrame(dict((c, [1, 2, 3]) for c in ['a', 'b', 'c']))
        df.set_index(['a', 'b', 'c'], inplace=True)
        s = Series([1], index=[(2, 2, 2)])
        df['val'] = 0
        df
        df['val'].update(s)

        expected = DataFrame(
            dict(a=[1, 2, 3], b=[1, 2, 3], c=[1, 2, 3], val=[0, 1, 0]))
        expected.set_index(['a', 'b', 'c'], inplace=True)
        tm.assert_frame_equal(df, expected)

        # GH 3970
        # these are chained assignments as well
        pd.set_option('chained_assignment', None)
        df = DataFrame({"aa": range(5), "bb": [2.2] * 5})
        df["cc"] = 0.0

        ck = [True] * len(df)

        df["bb"].iloc[0] = .13

        # TODO: unused
        df_tmp = df.iloc[ck]  # noqa

        df["bb"].iloc[0] = .15
        assert df['bb'].iloc[0] == 0.15
        pd.set_option('chained_assignment', 'raise')

        # GH 3217
        df = DataFrame(dict(a=[1, 3], b=[np.nan, 2]))
        df['c'] = np.nan
        df['c'].update(pd.Series(['foo'], index=[0]))

        expected = DataFrame(dict(a=[1, 3], b=[np.nan, 2], c=['foo', np.nan]))
        tm.assert_frame_equal(df, expected)

    def test_preserveRefs(self):
        seq = self.ts[[5, 10, 15]]
        seq[1] = np.NaN
        assert not np.isnan(self.ts[10])

    def test_drop(self):

        # unique
        s = Series([1, 2], index=['one', 'two'])
        expected = Series([1], index=['one'])
        result = s.drop(['two'])
        assert_series_equal(result, expected)
        result = s.drop('two', axis='rows')
        assert_series_equal(result, expected)

        # non-unique
        # GH 5248
        s = Series([1, 1, 2], index=['one', 'two', 'one'])
        expected = Series([1, 2], index=['one', 'one'])
        result = s.drop(['two'], axis=0)
        assert_series_equal(result, expected)
        result = s.drop('two')
        assert_series_equal(result, expected)

        expected = Series([1], index=['two'])
        result = s.drop(['one'])
        assert_series_equal(result, expected)
        result = s.drop('one')
        assert_series_equal(result, expected)

        # single string/tuple-like
        s = Series(range(3), index=list('abc'))
        pytest.raises(ValueError, s.drop, 'bc')
        pytest.raises(ValueError, s.drop, ('a', ))

        # errors='ignore'
        s = Series(range(3), index=list('abc'))
        result = s.drop('bc', errors='ignore')
        assert_series_equal(result, s)
        result = s.drop(['a', 'd'], errors='ignore')
        expected = s.iloc[1:]
        assert_series_equal(result, expected)

        # bad axis
        pytest.raises(ValueError, s.drop, 'one', axis='columns')

        # GH 8522
        s = Series([2, 3], index=[True, False])
        assert s.index.is_object()
        result = s.drop(True)
        expected = Series([3], index=[False])
        assert_series_equal(result, expected)

    def test_align(self):
        def _check_align(a, b, how='left', fill=None):
            aa, ab = a.align(b, join=how, fill_value=fill)

            join_index = a.index.join(b.index, how=how)
            if fill is not None:
                diff_a = aa.index.difference(join_index)
                diff_b = ab.index.difference(join_index)
                if len(diff_a) > 0:
                    assert (aa.reindex(diff_a) == fill).all()
                if len(diff_b) > 0:
                    assert (ab.reindex(diff_b) == fill).all()

            ea = a.reindex(join_index)
            eb = b.reindex(join_index)

            if fill is not None:
                ea = ea.fillna(fill)
                eb = eb.fillna(fill)

            assert_series_equal(aa, ea)
            assert_series_equal(ab, eb)
            assert aa.name == 'ts'
            assert ea.name == 'ts'
            assert ab.name == 'ts'
            assert eb.name == 'ts'

        for kind in JOIN_TYPES:
            _check_align(self.ts[2:], self.ts[:-5], how=kind)
            _check_align(self.ts[2:], self.ts[:-5], how=kind, fill=-1)

            # empty left
            _check_align(self.ts[:0], self.ts[:-5], how=kind)
            _check_align(self.ts[:0], self.ts[:-5], how=kind, fill=-1)

            # empty right
            _check_align(self.ts[:-5], self.ts[:0], how=kind)
            _check_align(self.ts[:-5], self.ts[:0], how=kind, fill=-1)

            # both empty
            _check_align(self.ts[:0], self.ts[:0], how=kind)
            _check_align(self.ts[:0], self.ts[:0], how=kind, fill=-1)

    def test_align_fill_method(self):
        def _check_align(a, b, how='left', method='pad', limit=None):
            aa, ab = a.align(b, join=how, method=method, limit=limit)

            join_index = a.index.join(b.index, how=how)
            ea = a.reindex(join_index)
            eb = b.reindex(join_index)

            ea = ea.fillna(method=method, limit=limit)
            eb = eb.fillna(method=method, limit=limit)

            assert_series_equal(aa, ea)
            assert_series_equal(ab, eb)

        for kind in JOIN_TYPES:
            for meth in ['pad', 'bfill']:
                _check_align(self.ts[2:], self.ts[:-5], how=kind, method=meth)
                _check_align(self.ts[2:], self.ts[:-5], how=kind, method=meth,
                             limit=1)

                # empty left
                _check_align(self.ts[:0], self.ts[:-5], how=kind, method=meth)
                _check_align(self.ts[:0], self.ts[:-5], how=kind, method=meth,
                             limit=1)

                # empty right
                _check_align(self.ts[:-5], self.ts[:0], how=kind, method=meth)
                _check_align(self.ts[:-5], self.ts[:0], how=kind, method=meth,
                             limit=1)

                # both empty
                _check_align(self.ts[:0], self.ts[:0], how=kind, method=meth)
                _check_align(self.ts[:0], self.ts[:0], how=kind, method=meth,
                             limit=1)

    def test_align_nocopy(self):
        b = self.ts[:5].copy()

        # do copy
        a = self.ts.copy()
        ra, _ = a.align(b, join='left')
        ra[:5] = 5
        assert not (a[:5] == 5).any()

        # do not copy
        a = self.ts.copy()
        ra, _ = a.align(b, join='left', copy=False)
        ra[:5] = 5
        assert (a[:5] == 5).all()

        # do copy
        a = self.ts.copy()
        b = self.ts[:5].copy()
        _, rb = a.align(b, join='right')
        rb[:3] = 5
        assert not (b[:3] == 5).any()

        # do not copy
        a = self.ts.copy()
        b = self.ts[:5].copy()
        _, rb = a.align(b, join='right', copy=False)
        rb[:2] = 5
        assert (b[:2] == 5).all()

    def test_align_same_index(self):
        a, b = self.ts.align(self.ts, copy=False)
        assert a.index is self.ts.index
        assert b.index is self.ts.index

        a, b = self.ts.align(self.ts, copy=True)
        assert a.index is not self.ts.index
        assert b.index is not self.ts.index

    def test_align_multiindex(self):
        # GH 10665

        midx = pd.MultiIndex.from_product([range(2), range(3), range(2)],
                                          names=('a', 'b', 'c'))
        idx = pd.Index(range(2), name='b')
        s1 = pd.Series(np.arange(12, dtype='int64'), index=midx)
        s2 = pd.Series(np.arange(2, dtype='int64'), index=idx)

        # these must be the same results (but flipped)
        res1l, res1r = s1.align(s2, join='left')
        res2l, res2r = s2.align(s1, join='right')

        expl = s1
        tm.assert_series_equal(expl, res1l)
        tm.assert_series_equal(expl, res2r)
        expr = pd.Series([0, 0, 1, 1, np.nan, np.nan] * 2, index=midx)
        tm.assert_series_equal(expr, res1r)
        tm.assert_series_equal(expr, res2l)

        res1l, res1r = s1.align(s2, join='right')
        res2l, res2r = s2.align(s1, join='left')

        exp_idx = pd.MultiIndex.from_product([range(2), range(2), range(2)],
                                             names=('a', 'b', 'c'))
        expl = pd.Series([0, 1, 2, 3, 6, 7, 8, 9], index=exp_idx)
        tm.assert_series_equal(expl, res1l)
        tm.assert_series_equal(expl, res2r)
        expr = pd.Series([0, 0, 1, 1] * 2, index=exp_idx)
        tm.assert_series_equal(expr, res1r)
        tm.assert_series_equal(expr, res2l)

    def test_reindex(self):

        identity = self.series.reindex(self.series.index)

        # __array_interface__ is not defined for older numpies
        # and on some pythons
        try:
            assert np.may_share_memory(self.series.index, identity.index)
        except AttributeError:
            pass

        assert identity.index.is_(self.series.index)
        assert identity.index.identical(self.series.index)

        subIndex = self.series.index[10:20]
        subSeries = self.series.reindex(subIndex)

        for idx, val in compat.iteritems(subSeries):
            assert val == self.series[idx]

        subIndex2 = self.ts.index[10:20]
        subTS = self.ts.reindex(subIndex2)

        for idx, val in compat.iteritems(subTS):
            assert val == self.ts[idx]
        stuffSeries = self.ts.reindex(subIndex)

        assert np.isnan(stuffSeries).all()

        # This is extremely important for the Cython code to not screw up
        nonContigIndex = self.ts.index[::2]
        subNonContig = self.ts.reindex(nonContigIndex)
        for idx, val in compat.iteritems(subNonContig):
            assert val == self.ts[idx]

        # return a copy the same index here
        result = self.ts.reindex()
        assert not (result is self.ts)

    def test_reindex_nan(self):
        ts = Series([2, 3, 5, 7], index=[1, 4, nan, 8])

        i, j = [nan, 1, nan, 8, 4, nan], [2, 0, 2, 3, 1, 2]
        assert_series_equal(ts.reindex(i), ts.iloc[j])

        ts.index = ts.index.astype('object')

        # reindex coerces index.dtype to float, loc/iloc doesn't
        assert_series_equal(ts.reindex(i), ts.iloc[j], check_index_type=False)

    def test_reindex_series_add_nat(self):
        rng = date_range('1/1/2000 00:00:00', periods=10, freq='10s')
        series = Series(rng)

        result = series.reindex(lrange(15))
        assert np.issubdtype(result.dtype, np.dtype('M8[ns]'))

        mask = result.isnull()
        assert mask[-5:].all()
        assert not mask[:-5].any()

    def test_reindex_with_datetimes(self):
        rng = date_range('1/1/2000', periods=20)
        ts = Series(np.random.randn(20), index=rng)

        result = ts.reindex(list(ts.index[5:10]))
        expected = ts[5:10]
        tm.assert_series_equal(result, expected)

        result = ts[list(ts.index[5:10])]
        tm.assert_series_equal(result, expected)

    def test_reindex_corner(self):
        # (don't forget to fix this) I think it's fixed
        self.empty.reindex(self.ts.index, method='pad')  # it works

        # corner case: pad empty series
        reindexed = self.empty.reindex(self.ts.index, method='pad')

        # pass non-Index
        reindexed = self.ts.reindex(list(self.ts.index))
        assert_series_equal(self.ts, reindexed)

        # bad fill method
        ts = self.ts[::2]
        pytest.raises(Exception, ts.reindex, self.ts.index, method='foo')

    def test_reindex_pad(self):

        s = Series(np.arange(10), dtype='int64')
        s2 = s[::2]

        reindexed = s2.reindex(s.index, method='pad')
        reindexed2 = s2.reindex(s.index, method='ffill')
        assert_series_equal(reindexed, reindexed2)

        expected = Series([0, 0, 2, 2, 4, 4, 6, 6, 8, 8], index=np.arange(10))
        assert_series_equal(reindexed, expected)

        # GH4604
        s = Series([1, 2, 3, 4, 5], index=['a', 'b', 'c', 'd', 'e'])
        new_index = ['a', 'g', 'c', 'f']
        expected = Series([1, 1, 3, 3], index=new_index)

        # this changes dtype because the ffill happens after
        result = s.reindex(new_index).ffill()
        assert_series_equal(result, expected.astype('float64'))

        result = s.reindex(new_index).ffill(downcast='infer')
        assert_series_equal(result, expected)

        expected = Series([1, 5, 3, 5], index=new_index)
        result = s.reindex(new_index, method='ffill')
        assert_series_equal(result, expected)

        # inferrence of new dtype
        s = Series([True, False, False, True], index=list('abcd'))
        new_index = 'agc'
        result = s.reindex(list(new_index)).ffill()
        expected = Series([True, True, False], index=list(new_index))
        assert_series_equal(result, expected)

        # GH4618 shifted series downcasting
        s = Series(False, index=lrange(0, 5))
        result = s.shift(1).fillna(method='bfill')
        expected = Series(False, index=lrange(0, 5))
        assert_series_equal(result, expected)

    def test_reindex_nearest(self):
        s = Series(np.arange(10, dtype='int64'))
        target = [0.1, 0.9, 1.5, 2.0]
        actual = s.reindex(target, method='nearest')
        expected = Series(np.around(target).astype('int64'), target)
        assert_series_equal(expected, actual)

        actual = s.reindex_like(actual, method='nearest')
        assert_series_equal(expected, actual)

        actual = s.reindex_like(actual, method='nearest', tolerance=1)
        assert_series_equal(expected, actual)

        actual = s.reindex(target, method='nearest', tolerance=0.2)
        expected = Series([0, 1, np.nan, 2], target)
        assert_series_equal(expected, actual)

    def test_reindex_backfill(self):
        pass

    def test_reindex_int(self):
        ts = self.ts[::2]
        int_ts = Series(np.zeros(len(ts), dtype=int), index=ts.index)

        # this should work fine
        reindexed_int = int_ts.reindex(self.ts.index)

        # if NaNs introduced
        assert reindexed_int.dtype == np.float_

        # NO NaNs introduced
        reindexed_int = int_ts.reindex(int_ts.index[::2])
        assert reindexed_int.dtype == np.int_

    def test_reindex_bool(self):

        # A series other than float, int, string, or object
        ts = self.ts[::2]
        bool_ts = Series(np.zeros(len(ts), dtype=bool), index=ts.index)

        # this should work fine
        reindexed_bool = bool_ts.reindex(self.ts.index)

        # if NaNs introduced
        assert reindexed_bool.dtype == np.object_

        # NO NaNs introduced
        reindexed_bool = bool_ts.reindex(bool_ts.index[::2])
        assert reindexed_bool.dtype == np.bool_

    def test_reindex_bool_pad(self):
        # fail
        ts = self.ts[5:]
        bool_ts = Series(np.zeros(len(ts), dtype=bool), index=ts.index)
        filled_bool = bool_ts.reindex(self.ts.index, method='pad')
        assert isnull(filled_bool[:5]).all()

    def test_reindex_like(self):
        other = self.ts[::2]
        assert_series_equal(self.ts.reindex(other.index),
                            self.ts.reindex_like(other))

        # GH 7179
        day1 = datetime(2013, 3, 5)
        day2 = datetime(2013, 5, 5)
        day3 = datetime(2014, 3, 5)

        series1 = Series([5, None, None], [day1, day2, day3])
        series2 = Series([None, None], [day1, day3])

        result = series1.reindex_like(series2, method='pad')
        expected = Series([5, np.nan], index=[day1, day3])
        assert_series_equal(result, expected)

    def test_reindex_fill_value(self):
        # -----------------------------------------------------------
        # floats
        floats = Series([1., 2., 3.])
        result = floats.reindex([1, 2, 3])
        expected = Series([2., 3., np.nan], index=[1, 2, 3])
        assert_series_equal(result, expected)

        result = floats.reindex([1, 2, 3], fill_value=0)
        expected = Series([2., 3., 0], index=[1, 2, 3])
        assert_series_equal(result, expected)

        # -----------------------------------------------------------
        # ints
        ints = Series([1, 2, 3])

        result = ints.reindex([1, 2, 3])
        expected = Series([2., 3., np.nan], index=[1, 2, 3])
        assert_series_equal(result, expected)

        # don't upcast
        result = ints.reindex([1, 2, 3], fill_value=0)
        expected = Series([2, 3, 0], index=[1, 2, 3])
        assert issubclass(result.dtype.type, np.integer)
        assert_series_equal(result, expected)

        # -----------------------------------------------------------
        # objects
        objects = Series([1, 2, 3], dtype=object)

        result = objects.reindex([1, 2, 3])
        expected = Series([2, 3, np.nan], index=[1, 2, 3], dtype=object)
        assert_series_equal(result, expected)

        result = objects.reindex([1, 2, 3], fill_value='foo')
        expected = Series([2, 3, 'foo'], index=[1, 2, 3], dtype=object)
        assert_series_equal(result, expected)

        # ------------------------------------------------------------
        # bools
        bools = Series([True, False, True])

        result = bools.reindex([1, 2, 3])
        expected = Series([False, True, np.nan], index=[1, 2, 3], dtype=object)
        assert_series_equal(result, expected)

        result = bools.reindex([1, 2, 3], fill_value=False)
        expected = Series([False, True, False], index=[1, 2, 3])
        assert_series_equal(result, expected)

    def test_select(self):
        n = len(self.ts)
        result = self.ts.select(lambda x: x >= self.ts.index[n // 2])
        expected = self.ts.reindex(self.ts.index[n // 2:])
        assert_series_equal(result, expected)

        result = self.ts.select(lambda x: x.weekday() == 2)
        expected = self.ts[self.ts.index.weekday == 2]
        assert_series_equal(result, expected)

    def test_cast_on_putmask(self):

        # GH 2746

        # need to upcast
        s = Series([1, 2], index=[1, 2], dtype='int64')
        s[[True, False]] = Series([0], index=[1], dtype='int64')
        expected = Series([0, 2], index=[1, 2], dtype='int64')

        assert_series_equal(s, expected)

    def test_type_promote_putmask(self):

        # GH8387: test that changing types does not break alignment
        ts = Series(np.random.randn(100), index=np.arange(100, 0, -1)).round(5)
        left, mask = ts.copy(), ts > 0
        right = ts[mask].copy().map(str)
        left[mask] = right
        assert_series_equal(left, ts.map(lambda t: str(t) if t > 0 else t))

        s = Series([0, 1, 2, 0])
        mask = s > 0
        s2 = s[mask].map(str)
        s[mask] = s2
        assert_series_equal(s, Series([0, '1', '2', 0]))

        s = Series([0, 'foo', 'bar', 0])
        mask = Series([False, True, True, False])
        s2 = s[mask]
        s[mask] = s2
        assert_series_equal(s, Series([0, 'foo', 'bar', 0]))

    def test_head_tail(self):
        assert_series_equal(self.series.head(), self.series[:5])
        assert_series_equal(self.series.head(0), self.series[0:0])
        assert_series_equal(self.series.tail(), self.series[-5:])
        assert_series_equal(self.series.tail(0), self.series[0:0])

    def test_multilevel_preserve_name(self):
        index = MultiIndex(levels=[['foo', 'bar', 'baz', 'qux'], ['one', 'two',
                                                                  'three']],
                           labels=[[0, 0, 0, 1, 1, 2, 2, 3, 3, 3],
                                   [0, 1, 2, 0, 1, 1, 2, 0, 1, 2]],
                           names=['first', 'second'])
        s = Series(np.random.randn(len(index)), index=index, name='sth')

        result = s['foo']
        result2 = s.loc['foo']
        assert result.name == s.name
        assert result2.name == s.name

    def test_setitem_scalar_into_readonly_backing_data(self):
        # GH14359: test that you cannot mutate a read only buffer

        array = np.zeros(5)
        array.flags.writeable = False  # make the array immutable
        series = Series(array)

        for n in range(len(series)):
            with pytest.raises(ValueError):
                series[n] = 1

            assert array[n] == 0

    def test_setitem_slice_into_readonly_backing_data(self):
        # GH14359: test that you cannot mutate a read only buffer

        array = np.zeros(5)
        array.flags.writeable = False  # make the array immutable
        series = Series(array)

        with pytest.raises(ValueError):
            series[1:3] = 1

        assert not array.any()


class TestTimeSeriesDuplicates(object):

    def setup_method(self, method):
        dates = [datetime(2000, 1, 2), datetime(2000, 1, 2),
                 datetime(2000, 1, 2), datetime(2000, 1, 3),
                 datetime(2000, 1, 3), datetime(2000, 1, 3),
                 datetime(2000, 1, 4), datetime(2000, 1, 4),
                 datetime(2000, 1, 4), datetime(2000, 1, 5)]

        self.dups = Series(np.random.randn(len(dates)), index=dates)

    def test_constructor(self):
        assert isinstance(self.dups, Series)
        assert isinstance(self.dups.index, DatetimeIndex)

    def test_is_unique_monotonic(self):
        assert not self.dups.index.is_unique

    def test_index_unique(self):
        uniques = self.dups.index.unique()
        expected = DatetimeIndex([datetime(2000, 1, 2), datetime(2000, 1, 3),
                                  datetime(2000, 1, 4), datetime(2000, 1, 5)])
        assert uniques.dtype == 'M8[ns]'  # sanity
        tm.assert_index_equal(uniques, expected)
        assert self.dups.index.nunique() == 4

        # #2563
        assert isinstance(uniques, DatetimeIndex)

        dups_local = self.dups.index.tz_localize('US/Eastern')
        dups_local.name = 'foo'
        result = dups_local.unique()
        expected = DatetimeIndex(expected, name='foo')
        expected = expected.tz_localize('US/Eastern')
        assert result.tz is not None
        assert result.name == 'foo'
        tm.assert_index_equal(result, expected)

        # NaT, note this is excluded
        arr = [1370745748 + t for t in range(20)] + [tslib.iNaT]
        idx = DatetimeIndex(arr * 3)
        tm.assert_index_equal(idx.unique(), DatetimeIndex(arr))
        assert idx.nunique() == 20
        assert idx.nunique(dropna=False) == 21

        arr = [Timestamp('2013-06-09 02:42:28') + timedelta(seconds=t)
               for t in range(20)] + [NaT]
        idx = DatetimeIndex(arr * 3)
        tm.assert_index_equal(idx.unique(), DatetimeIndex(arr))
        assert idx.nunique() == 20
        assert idx.nunique(dropna=False) == 21

    def test_index_dupes_contains(self):
        d = datetime(2011, 12, 5, 20, 30)
        ix = DatetimeIndex([d, d])
        assert d in ix

    def test_duplicate_dates_indexing(self):
        ts = self.dups

        uniques = ts.index.unique()
        for date in uniques:
            result = ts[date]

            mask = ts.index == date
            total = (ts.index == date).sum()
            expected = ts[mask]
            if total > 1:
                assert_series_equal(result, expected)
            else:
                assert_almost_equal(result, expected[0])

            cp = ts.copy()
            cp[date] = 0
            expected = Series(np.where(mask, 0, ts), index=ts.index)
            assert_series_equal(cp, expected)

        pytest.raises(KeyError, ts.__getitem__, datetime(2000, 1, 6))

        # new index
        ts[datetime(2000, 1, 6)] = 0
        assert ts[datetime(2000, 1, 6)] == 0

    def test_range_slice(self):
        idx = DatetimeIndex(['1/1/2000', '1/2/2000', '1/2/2000', '1/3/2000',
                             '1/4/2000'])

        ts = Series(np.random.randn(len(idx)), index=idx)

        result = ts['1/2/2000':]
        expected = ts[1:]
        assert_series_equal(result, expected)

        result = ts['1/2/2000':'1/3/2000']
        expected = ts[1:4]
        assert_series_equal(result, expected)

    def test_groupby_average_dup_values(self):
        result = self.dups.groupby(level=0).mean()
        expected = self.dups.groupby(self.dups.index).mean()
        assert_series_equal(result, expected)

    def test_indexing_over_size_cutoff(self):
        import datetime
        # #1821

        old_cutoff = _index._SIZE_CUTOFF
        try:
            _index._SIZE_CUTOFF = 1000

            # create large list of non periodic datetime
            dates = []
            sec = datetime.timedelta(seconds=1)
            half_sec = datetime.timedelta(microseconds=500000)
            d = datetime.datetime(2011, 12, 5, 20, 30)
            n = 1100
            for i in range(n):
                dates.append(d)
                dates.append(d + sec)
                dates.append(d + sec + half_sec)
                dates.append(d + sec + sec + half_sec)
                d += 3 * sec

            # duplicate some values in the list
            duplicate_positions = np.random.randint(0, len(dates) - 1, 20)
            for p in duplicate_positions:
                dates[p + 1] = dates[p]

            df = DataFrame(np.random.randn(len(dates), 4),
                           index=dates,
                           columns=list('ABCD'))

            pos = n * 3
            timestamp = df.index[pos]
            assert timestamp in df.index

            # it works!
            df.loc[timestamp]
            assert len(df.loc[[timestamp]]) > 0
        finally:
            _index._SIZE_CUTOFF = old_cutoff

    def test_indexing_unordered(self):
        # GH 2437
        rng = date_range(start='2011-01-01', end='2011-01-15')
        ts = Series(np.random.rand(len(rng)), index=rng)
        ts2 = pd.concat([ts[0:4], ts[-4:], ts[4:-4]])

        for t in ts.index:
            # TODO: unused?
            s = str(t)  # noqa

            expected = ts[t]
            result = ts2[t]
            assert expected == result

        # GH 3448 (ranges)
        def compare(slobj):
            result = ts2[slobj].copy()
            result = result.sort_index()
            expected = ts[slobj]
            assert_series_equal(result, expected)

        compare(slice('2011-01-01', '2011-01-15'))
        compare(slice('2010-12-30', '2011-01-15'))
        compare(slice('2011-01-01', '2011-01-16'))

        # partial ranges
        compare(slice('2011-01-01', '2011-01-6'))
        compare(slice('2011-01-06', '2011-01-8'))
        compare(slice('2011-01-06', '2011-01-12'))

        # single values
        result = ts2['2011'].sort_index()
        expected = ts['2011']
        assert_series_equal(result, expected)

        # diff freq
        rng = date_range(datetime(2005, 1, 1), periods=20, freq='M')
        ts = Series(np.arange(len(rng)), index=rng)
        ts = ts.take(np.random.permutation(20))

        result = ts['2005']
        for t in result.index:
            assert t.year == 2005

    def test_indexing(self):

        idx = date_range("2001-1-1", periods=20, freq='M')
        ts = Series(np.random.rand(len(idx)), index=idx)

        # getting

        # GH 3070, make sure semantics work on Series/Frame
        expected = ts['2001']
        expected.name = 'A'

        df = DataFrame(dict(A=ts))
        result = df['2001']['A']
        assert_series_equal(expected, result)

        # setting
        ts['2001'] = 1
        expected = ts['2001']
        expected.name = 'A'

        df.loc['2001', 'A'] = 1

        result = df['2001']['A']
        assert_series_equal(expected, result)

        # GH3546 (not including times on the last day)
        idx = date_range(start='2013-05-31 00:00', end='2013-05-31 23:00',
                         freq='H')
        ts = Series(lrange(len(idx)), index=idx)
        expected = ts['2013-05']
        assert_series_equal(expected, ts)

        idx = date_range(start='2013-05-31 00:00', end='2013-05-31 23:59',
                         freq='S')
        ts = Series(lrange(len(idx)), index=idx)
        expected = ts['2013-05']
        assert_series_equal(expected, ts)

        idx = [Timestamp('2013-05-31 00:00'),
               Timestamp(datetime(2013, 5, 31, 23, 59, 59, 999999))]
        ts = Series(lrange(len(idx)), index=idx)
        expected = ts['2013']
        assert_series_equal(expected, ts)

        # GH14826, indexing with a seconds resolution string / datetime object
        df = DataFrame(np.random.rand(5, 5),
                       columns=['open', 'high', 'low', 'close', 'volume'],
                       index=date_range('2012-01-02 18:01:00',
                                        periods=5, tz='US/Central', freq='s'))
        expected = df.loc[[df.index[2]]]

        # this is a single date, so will raise
        pytest.raises(KeyError, df.__getitem__, '2012-01-02 18:01:02', )
        pytest.raises(KeyError, df.__getitem__, df.index[2], )


class TestDatetimeIndexing(object):
    """
    Also test support for datetime64[ns] in Series / DataFrame
    """

    def setup_method(self, method):
        dti = DatetimeIndex(start=datetime(2005, 1, 1),
                            end=datetime(2005, 1, 10), freq='Min')
        self.series = Series(np.random.rand(len(dti)), dti)

    def test_fancy_getitem(self):
        dti = DatetimeIndex(freq='WOM-1FRI', start=datetime(2005, 1, 1),
                            end=datetime(2010, 1, 1))

        s = Series(np.arange(len(dti)), index=dti)

        assert s[48] == 48
        assert s['1/2/2009'] == 48
        assert s['2009-1-2'] == 48
        assert s[datetime(2009, 1, 2)] == 48
        assert s[lib.Timestamp(datetime(2009, 1, 2))] == 48
        pytest.raises(KeyError, s.__getitem__, '2009-1-3')

        assert_series_equal(s['3/6/2009':'2009-06-05'],
                            s[datetime(2009, 3, 6):datetime(2009, 6, 5)])

    def test_fancy_setitem(self):
        dti = DatetimeIndex(freq='WOM-1FRI', start=datetime(2005, 1, 1),
                            end=datetime(2010, 1, 1))

        s = Series(np.arange(len(dti)), index=dti)
        s[48] = -1
        assert s[48] == -1
        s['1/2/2009'] = -2
        assert s[48] == -2
        s['1/2/2009':'2009-06-05'] = -3
        assert (s[48:54] == -3).all()

    def test_dti_snap(self):
        dti = DatetimeIndex(['1/1/2002', '1/2/2002', '1/3/2002', '1/4/2002',
                             '1/5/2002', '1/6/2002', '1/7/2002'], freq='D')

        res = dti.snap(freq='W-MON')
        exp = date_range('12/31/2001', '1/7/2002', freq='w-mon')
        exp = exp.repeat([3, 4])
        assert (res == exp).all()

        res = dti.snap(freq='B')

        exp = date_range('1/1/2002', '1/7/2002', freq='b')
        exp = exp.repeat([1, 1, 1, 2, 2])
        assert (res == exp).all()

    def test_dti_reset_index_round_trip(self):
        dti = DatetimeIndex(start='1/1/2001', end='6/1/2001', freq='D')
        d1 = DataFrame({'v': np.random.rand(len(dti))}, index=dti)
        d2 = d1.reset_index()
        assert d2.dtypes[0] == np.dtype('M8[ns]')
        d3 = d2.set_index('index')
        assert_frame_equal(d1, d3, check_names=False)

        # #2329
        stamp = datetime(2012, 11, 22)
        df = DataFrame([[stamp, 12.1]], columns=['Date', 'Value'])
        df = df.set_index('Date')

        assert df.index[0] == stamp
        assert df.reset_index()['Date'][0] == stamp

    def test_series_set_value(self):
        # #1561

        dates = [datetime(2001, 1, 1), datetime(2001, 1, 2)]
        index = DatetimeIndex(dates)

        s = Series().set_value(dates[0], 1.)
        s2 = s.set_value(dates[1], np.nan)

        exp = Series([1., np.nan], index=index)

        assert_series_equal(s2, exp)

        # s = Series(index[:1], index[:1])
        # s2 = s.set_value(dates[1], index[1])
        # assert s2.values.dtype == 'M8[ns]'

    @slow
    def test_slice_locs_indexerror(self):
        times = [datetime(2000, 1, 1) + timedelta(minutes=i * 10)
                 for i in range(100000)]
        s = Series(lrange(100000), times)
        s.loc[datetime(1900, 1, 1):datetime(2100, 1, 1)]

    def test_slicing_datetimes(self):

        # GH 7523

        # unique
        df = DataFrame(np.arange(4., dtype='float64'),
                       index=[datetime(2001, 1, i, 10, 00)
                              for i in [1, 2, 3, 4]])
        result = df.loc[datetime(2001, 1, 1, 10):]
        assert_frame_equal(result, df)
        result = df.loc[:datetime(2001, 1, 4, 10)]
        assert_frame_equal(result, df)
        result = df.loc[datetime(2001, 1, 1, 10):datetime(2001, 1, 4, 10)]
        assert_frame_equal(result, df)

        result = df.loc[datetime(2001, 1, 1, 11):]
        expected = df.iloc[1:]
        assert_frame_equal(result, expected)
        result = df.loc['20010101 11':]
        assert_frame_equal(result, expected)

        # duplicates
        df = pd.DataFrame(np.arange(5., dtype='float64'),
                          index=[datetime(2001, 1, i, 10, 00)
                                 for i in [1, 2, 2, 3, 4]])

        result = df.loc[datetime(2001, 1, 1, 10):]
        assert_frame_equal(result, df)
        result = df.loc[:datetime(2001, 1, 4, 10)]
        assert_frame_equal(result, df)
        result = df.loc[datetime(2001, 1, 1, 10):datetime(2001, 1, 4, 10)]
        assert_frame_equal(result, df)

        result = df.loc[datetime(2001, 1, 1, 11):]
        expected = df.iloc[1:]
        assert_frame_equal(result, expected)
        result = df.loc['20010101 11':]
        assert_frame_equal(result, expected)

    def test_frame_datetime64_duplicated(self):
        dates = date_range('2010-07-01', end='2010-08-05')

        tst = DataFrame({'symbol': 'AAA', 'date': dates})
        result = tst.duplicated(['date', 'symbol'])
        assert (-result).all()

        tst = DataFrame({'date': dates})
        result = tst.duplicated()
        assert (-result).all()


class TestNatIndexing(object):

    def setup_method(self, method):
        self.series = Series(date_range('1/1/2000', periods=10))

    # ---------------------------------------------------------------------
    # NaT support

    def test_set_none_nan(self):
        self.series[3] = None
        assert self.series[3] is NaT

        self.series[3:5] = None
        assert self.series[4] is NaT

        self.series[5] = np.nan
        assert self.series[5] is NaT

        self.series[5:7] = np.nan
        assert self.series[6] is NaT

    def test_nat_operations(self):
        # GH 8617
        s = Series([0, pd.NaT], dtype='m8[ns]')
        exp = s[0]
        assert s.median() == exp
        assert s.min() == exp
        assert s.max() == exp

    def test_round_nat(self):
        # GH14940
        s = Series([pd.NaT])
        expected = Series(pd.NaT)
        for method in ["round", "floor", "ceil"]:
            round_method = getattr(s.dt, method)
            for freq in ["s", "5s", "min", "5min", "h", "5h"]:
                assert_series_equal(round_method(freq), expected)
