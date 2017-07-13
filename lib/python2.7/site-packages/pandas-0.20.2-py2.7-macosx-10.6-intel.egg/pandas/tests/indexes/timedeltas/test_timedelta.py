import pytest

import numpy as np
from datetime import timedelta

import pandas as pd
import pandas.util.testing as tm
from pandas import (timedelta_range, date_range, Series, Timedelta,
                    DatetimeIndex, TimedeltaIndex, Index, DataFrame,
                    Int64Index, _np_version_under1p8)
from pandas.util.testing import (assert_almost_equal, assert_series_equal,
                                 assert_index_equal)

from ..datetimelike import DatetimeLike

randn = np.random.randn


class TestTimedeltaIndex(DatetimeLike):
    _holder = TimedeltaIndex
    _multiprocess_can_split_ = True

    def setup_method(self, method):
        self.indices = dict(index=tm.makeTimedeltaIndex(10))
        self.setup_indices()

    def create_index(self):
        return pd.to_timedelta(range(5), unit='d') + pd.offsets.Hour(1)

    def test_shift(self):
        # test shift for TimedeltaIndex
        # err8083

        drange = self.create_index()
        result = drange.shift(1)
        expected = TimedeltaIndex(['1 days 01:00:00', '2 days 01:00:00',
                                   '3 days 01:00:00',
                                   '4 days 01:00:00', '5 days 01:00:00'],
                                  freq='D')
        tm.assert_index_equal(result, expected)

        result = drange.shift(3, freq='2D 1s')
        expected = TimedeltaIndex(['6 days 01:00:03', '7 days 01:00:03',
                                   '8 days 01:00:03', '9 days 01:00:03',
                                   '10 days 01:00:03'], freq='D')
        tm.assert_index_equal(result, expected)

    def test_get_loc(self):
        idx = pd.to_timedelta(['0 days', '1 days', '2 days'])

        for method in [None, 'pad', 'backfill', 'nearest']:
            assert idx.get_loc(idx[1], method) == 1
            assert idx.get_loc(idx[1].to_pytimedelta(), method) == 1
            assert idx.get_loc(str(idx[1]), method) == 1

        assert idx.get_loc(idx[1], 'pad',
                           tolerance=pd.Timedelta(0)) == 1
        assert idx.get_loc(idx[1], 'pad',
                           tolerance=np.timedelta64(0, 's')) == 1
        assert idx.get_loc(idx[1], 'pad',
                           tolerance=timedelta(0)) == 1

        with tm.assert_raises_regex(ValueError, 'must be convertible'):
            idx.get_loc(idx[1], method='nearest', tolerance='foo')

        for method, loc in [('pad', 1), ('backfill', 2), ('nearest', 1)]:
            assert idx.get_loc('1 day 1 hour', method) == loc

    def test_get_loc_nat(self):
        tidx = TimedeltaIndex(['1 days 01:00:00', 'NaT', '2 days 01:00:00'])

        assert tidx.get_loc(pd.NaT) == 1
        assert tidx.get_loc(None) == 1
        assert tidx.get_loc(float('nan')) == 1
        assert tidx.get_loc(np.nan) == 1

    def test_get_indexer(self):
        idx = pd.to_timedelta(['0 days', '1 days', '2 days'])
        tm.assert_numpy_array_equal(idx.get_indexer(idx),
                                    np.array([0, 1, 2], dtype=np.intp))

        target = pd.to_timedelta(['-1 hour', '12 hours', '1 day 1 hour'])
        tm.assert_numpy_array_equal(idx.get_indexer(target, 'pad'),
                                    np.array([-1, 0, 1], dtype=np.intp))
        tm.assert_numpy_array_equal(idx.get_indexer(target, 'backfill'),
                                    np.array([0, 1, 2], dtype=np.intp))
        tm.assert_numpy_array_equal(idx.get_indexer(target, 'nearest'),
                                    np.array([0, 1, 1], dtype=np.intp))

        res = idx.get_indexer(target, 'nearest',
                              tolerance=pd.Timedelta('1 hour'))
        tm.assert_numpy_array_equal(res, np.array([0, -1, 1], dtype=np.intp))

    def test_numeric_compat(self):

        idx = self._holder(np.arange(5, dtype='int64'))
        didx = self._holder(np.arange(5, dtype='int64') ** 2)
        result = idx * 1
        tm.assert_index_equal(result, idx)

        result = 1 * idx
        tm.assert_index_equal(result, idx)

        result = idx / 1
        tm.assert_index_equal(result, idx)

        result = idx // 1
        tm.assert_index_equal(result, idx)

        result = idx * np.array(5, dtype='int64')
        tm.assert_index_equal(result,
                              self._holder(np.arange(5, dtype='int64') * 5))

        result = idx * np.arange(5, dtype='int64')
        tm.assert_index_equal(result, didx)

        result = idx * Series(np.arange(5, dtype='int64'))
        tm.assert_index_equal(result, didx)

        result = idx * Series(np.arange(5, dtype='float64') + 0.1)
        tm.assert_index_equal(result, self._holder(np.arange(
            5, dtype='float64') * (np.arange(5, dtype='float64') + 0.1)))

        # invalid
        pytest.raises(TypeError, lambda: idx * idx)
        pytest.raises(ValueError, lambda: idx * self._holder(np.arange(3)))
        pytest.raises(ValueError, lambda: idx * np.array([1, 2]))

    def test_pickle_compat_construction(self):
        pass

    def test_ufunc_coercions(self):
        # normal ops are also tested in tseries/test_timedeltas.py
        idx = TimedeltaIndex(['2H', '4H', '6H', '8H', '10H'],
                             freq='2H', name='x')

        for result in [idx * 2, np.multiply(idx, 2)]:
            assert isinstance(result, TimedeltaIndex)
            exp = TimedeltaIndex(['4H', '8H', '12H', '16H', '20H'],
                                 freq='4H', name='x')
            tm.assert_index_equal(result, exp)
            assert result.freq == '4H'

        for result in [idx / 2, np.divide(idx, 2)]:
            assert isinstance(result, TimedeltaIndex)
            exp = TimedeltaIndex(['1H', '2H', '3H', '4H', '5H'],
                                 freq='H', name='x')
            tm.assert_index_equal(result, exp)
            assert result.freq == 'H'

        idx = TimedeltaIndex(['2H', '4H', '6H', '8H', '10H'],
                             freq='2H', name='x')
        for result in [-idx, np.negative(idx)]:
            assert isinstance(result, TimedeltaIndex)
            exp = TimedeltaIndex(['-2H', '-4H', '-6H', '-8H', '-10H'],
                                 freq='-2H', name='x')
            tm.assert_index_equal(result, exp)
            assert result.freq == '-2H'

        idx = TimedeltaIndex(['-2H', '-1H', '0H', '1H', '2H'],
                             freq='H', name='x')
        for result in [abs(idx), np.absolute(idx)]:
            assert isinstance(result, TimedeltaIndex)
            exp = TimedeltaIndex(['2H', '1H', '0H', '1H', '2H'],
                                 freq=None, name='x')
            tm.assert_index_equal(result, exp)
            assert result.freq is None

    def test_fillna_timedelta(self):
        # GH 11343
        idx = pd.TimedeltaIndex(['1 day', pd.NaT, '3 day'])

        exp = pd.TimedeltaIndex(['1 day', '2 day', '3 day'])
        tm.assert_index_equal(idx.fillna(pd.Timedelta('2 day')), exp)

        exp = pd.TimedeltaIndex(['1 day', '3 hour', '3 day'])
        idx.fillna(pd.Timedelta('3 hour'))

        exp = pd.Index(
            [pd.Timedelta('1 day'), 'x', pd.Timedelta('3 day')], dtype=object)
        tm.assert_index_equal(idx.fillna('x'), exp)

    def test_difference_freq(self):
        # GH14323: Difference of TimedeltaIndex should not preserve frequency

        index = timedelta_range("0 days", "5 days", freq="D")

        other = timedelta_range("1 days", "4 days", freq="D")
        expected = TimedeltaIndex(["0 days", "5 days"], freq=None)
        idx_diff = index.difference(other)
        tm.assert_index_equal(idx_diff, expected)
        tm.assert_attr_equal('freq', idx_diff, expected)

        other = timedelta_range("2 days", "5 days", freq="D")
        idx_diff = index.difference(other)
        expected = TimedeltaIndex(["0 days", "1 days"], freq=None)
        tm.assert_index_equal(idx_diff, expected)
        tm.assert_attr_equal('freq', idx_diff, expected)

    def test_take(self):

        tds = ['1day 02:00:00', '1 day 04:00:00', '1 day 10:00:00']
        idx = TimedeltaIndex(start='1d', end='2d', freq='H', name='idx')
        expected = TimedeltaIndex(tds, freq=None, name='idx')

        taken1 = idx.take([2, 4, 10])
        taken2 = idx[[2, 4, 10]]

        for taken in [taken1, taken2]:
            tm.assert_index_equal(taken, expected)
            assert isinstance(taken, TimedeltaIndex)
            assert taken.freq is None
            assert taken.name == expected.name

    def test_take_fill_value(self):
        # GH 12631
        idx = pd.TimedeltaIndex(['1 days', '2 days', '3 days'],
                                name='xxx')
        result = idx.take(np.array([1, 0, -1]))
        expected = pd.TimedeltaIndex(['2 days', '1 days', '3 days'],
                                     name='xxx')
        tm.assert_index_equal(result, expected)

        # fill_value
        result = idx.take(np.array([1, 0, -1]), fill_value=True)
        expected = pd.TimedeltaIndex(['2 days', '1 days', 'NaT'],
                                     name='xxx')
        tm.assert_index_equal(result, expected)

        # allow_fill=False
        result = idx.take(np.array([1, 0, -1]), allow_fill=False,
                          fill_value=True)
        expected = pd.TimedeltaIndex(['2 days', '1 days', '3 days'],
                                     name='xxx')
        tm.assert_index_equal(result, expected)

        msg = ('When allow_fill=True and fill_value is not None, '
               'all indices must be >= -1')
        with tm.assert_raises_regex(ValueError, msg):
            idx.take(np.array([1, 0, -2]), fill_value=True)
        with tm.assert_raises_regex(ValueError, msg):
            idx.take(np.array([1, 0, -5]), fill_value=True)

        with pytest.raises(IndexError):
            idx.take(np.array([1, -5]))

    def test_isin(self):

        index = tm.makeTimedeltaIndex(4)
        result = index.isin(index)
        assert result.all()

        result = index.isin(list(index))
        assert result.all()

        assert_almost_equal(index.isin([index[2], 5]),
                            np.array([False, False, True, False]))

    def test_factorize(self):
        idx1 = TimedeltaIndex(['1 day', '1 day', '2 day', '2 day', '3 day',
                               '3 day'])

        exp_arr = np.array([0, 0, 1, 1, 2, 2], dtype=np.intp)
        exp_idx = TimedeltaIndex(['1 day', '2 day', '3 day'])

        arr, idx = idx1.factorize()
        tm.assert_numpy_array_equal(arr, exp_arr)
        tm.assert_index_equal(idx, exp_idx)

        arr, idx = idx1.factorize(sort=True)
        tm.assert_numpy_array_equal(arr, exp_arr)
        tm.assert_index_equal(idx, exp_idx)

        # freq must be preserved
        idx3 = timedelta_range('1 day', periods=4, freq='s')
        exp_arr = np.array([0, 1, 2, 3], dtype=np.intp)
        arr, idx = idx3.factorize()
        tm.assert_numpy_array_equal(arr, exp_arr)
        tm.assert_index_equal(idx, idx3)

    def test_join_self(self):

        index = timedelta_range('1 day', periods=10)
        kinds = 'outer', 'inner', 'left', 'right'
        for kind in kinds:
            joined = index.join(index, how=kind)
            tm.assert_index_equal(index, joined)

    def test_slice_keeps_name(self):

        # GH4226
        dr = pd.timedelta_range('1d', '5d', freq='H', name='timebucket')
        assert dr[1:].name == dr.name

    def test_does_not_convert_mixed_integer(self):
        df = tm.makeCustomDataframe(10, 10,
                                    data_gen_f=lambda *args, **kwargs: randn(),
                                    r_idx_type='i', c_idx_type='td')
        str(df)

        cols = df.columns.join(df.index, how='outer')
        joined = cols.join(df.columns)
        assert cols.dtype == np.dtype('O')
        assert cols.dtype == joined.dtype
        tm.assert_index_equal(cols, joined)

    def test_sort_values(self):

        idx = TimedeltaIndex(['4d', '1d', '2d'])

        ordered = idx.sort_values()
        assert ordered.is_monotonic

        ordered = idx.sort_values(ascending=False)
        assert ordered[::-1].is_monotonic

        ordered, dexer = idx.sort_values(return_indexer=True)
        assert ordered.is_monotonic

        tm.assert_numpy_array_equal(dexer, np.array([1, 2, 0]),
                                    check_dtype=False)

        ordered, dexer = idx.sort_values(return_indexer=True, ascending=False)
        assert ordered[::-1].is_monotonic

        tm.assert_numpy_array_equal(dexer, np.array([0, 2, 1]),
                                    check_dtype=False)

    def test_get_duplicates(self):
        idx = TimedeltaIndex(['1 day', '2 day', '2 day', '3 day', '3day',
                              '4day'])

        result = idx.get_duplicates()
        ex = TimedeltaIndex(['2 day', '3day'])
        tm.assert_index_equal(result, ex)

    def test_argmin_argmax(self):
        idx = TimedeltaIndex(['1 day 00:00:05', '1 day 00:00:01',
                              '1 day 00:00:02'])
        assert idx.argmin() == 1
        assert idx.argmax() == 0

    def test_misc_coverage(self):

        rng = timedelta_range('1 day', periods=5)
        result = rng.groupby(rng.days)
        assert isinstance(list(result.values())[0][0], Timedelta)

        idx = TimedeltaIndex(['3d', '1d', '2d'])
        assert not idx.equals(list(idx))

        non_td = Index(list('abc'))
        assert not idx.equals(list(non_td))

    def test_map(self):

        rng = timedelta_range('1 day', periods=10)

        f = lambda x: x.days
        result = rng.map(f)
        exp = Int64Index([f(x) for x in rng])
        tm.assert_index_equal(result, exp)

    def test_comparisons_nat(self):

        tdidx1 = pd.TimedeltaIndex(['1 day', pd.NaT, '1 day 00:00:01', pd.NaT,
                                    '1 day 00:00:01', '5 day 00:00:03'])
        tdidx2 = pd.TimedeltaIndex(['2 day', '2 day', pd.NaT, pd.NaT,
                                    '1 day 00:00:02', '5 days 00:00:03'])
        tdarr = np.array([np.timedelta64(2, 'D'),
                          np.timedelta64(2, 'D'), np.timedelta64('nat'),
                          np.timedelta64('nat'),
                          np.timedelta64(1, 'D') + np.timedelta64(2, 's'),
                          np.timedelta64(5, 'D') + np.timedelta64(3, 's')])

        if _np_version_under1p8:
            # cannot test array because np.datetime('nat') returns today's date
            cases = [(tdidx1, tdidx2)]
        else:
            cases = [(tdidx1, tdidx2), (tdidx1, tdarr)]

        # Check pd.NaT is handles as the same as np.nan
        for idx1, idx2 in cases:

            result = idx1 < idx2
            expected = np.array([True, False, False, False, True, False])
            tm.assert_numpy_array_equal(result, expected)

            result = idx2 > idx1
            expected = np.array([True, False, False, False, True, False])
            tm.assert_numpy_array_equal(result, expected)

            result = idx1 <= idx2
            expected = np.array([True, False, False, False, True, True])
            tm.assert_numpy_array_equal(result, expected)

            result = idx2 >= idx1
            expected = np.array([True, False, False, False, True, True])
            tm.assert_numpy_array_equal(result, expected)

            result = idx1 == idx2
            expected = np.array([False, False, False, False, False, True])
            tm.assert_numpy_array_equal(result, expected)

            result = idx1 != idx2
            expected = np.array([True, True, True, True, True, False])
            tm.assert_numpy_array_equal(result, expected)

    def test_comparisons_coverage(self):
        rng = timedelta_range('1 days', periods=10)

        result = rng < rng[3]
        exp = np.array([True, True, True] + [False] * 7)
        tm.assert_numpy_array_equal(result, exp)

        # raise TypeError for now
        pytest.raises(TypeError, rng.__lt__, rng[3].value)

        result = rng == list(rng)
        exp = rng == rng
        tm.assert_numpy_array_equal(result, exp)

    def test_total_seconds(self):
        # GH 10939
        # test index
        rng = timedelta_range('1 days, 10:11:12.100123456', periods=2,
                              freq='s')
        expt = [1 * 86400 + 10 * 3600 + 11 * 60 + 12 + 100123456. / 1e9,
                1 * 86400 + 10 * 3600 + 11 * 60 + 13 + 100123456. / 1e9]
        tm.assert_almost_equal(rng.total_seconds(), Index(expt))

        # test Series
        s = Series(rng)
        s_expt = Series(expt, index=[0, 1])
        tm.assert_series_equal(s.dt.total_seconds(), s_expt)

        # with nat
        s[1] = np.nan
        s_expt = Series([1 * 86400 + 10 * 3600 + 11 * 60 +
                         12 + 100123456. / 1e9, np.nan], index=[0, 1])
        tm.assert_series_equal(s.dt.total_seconds(), s_expt)

        # with both nat
        s = Series([np.nan, np.nan], dtype='timedelta64[ns]')
        tm.assert_series_equal(s.dt.total_seconds(),
                               Series([np.nan, np.nan], index=[0, 1]))

    def test_pass_TimedeltaIndex_to_index(self):

        rng = timedelta_range('1 days', '10 days')
        idx = Index(rng, dtype=object)

        expected = Index(rng.to_pytimedelta(), dtype=object)

        tm.assert_numpy_array_equal(idx.values, expected.values)

    def test_pickle(self):

        rng = timedelta_range('1 days', periods=10)
        rng_p = tm.round_trip_pickle(rng)
        tm.assert_index_equal(rng, rng_p)

    def test_hash_error(self):
        index = timedelta_range('1 days', periods=10)
        with tm.assert_raises_regex(TypeError, "unhashable type: %r" %
                                    type(index).__name__):
            hash(index)

    def test_append_join_nondatetimeindex(self):
        rng = timedelta_range('1 days', periods=10)
        idx = Index(['a', 'b', 'c', 'd'])

        result = rng.append(idx)
        assert isinstance(result[0], Timedelta)

        # it works
        rng.join(idx, how='outer')

    def test_append_numpy_bug_1681(self):

        td = timedelta_range('1 days', '10 days', freq='2D')
        a = DataFrame()
        c = DataFrame({'A': 'foo', 'B': td}, index=td)
        str(c)

        result = a.append(c)
        assert (result['B'] == td).all()

    def test_fields(self):
        rng = timedelta_range('1 days, 10:11:12.100123456', periods=2,
                              freq='s')
        tm.assert_index_equal(rng.days, Index([1, 1], dtype='int64'))
        tm.assert_index_equal(
            rng.seconds,
            Index([10 * 3600 + 11 * 60 + 12, 10 * 3600 + 11 * 60 + 13],
                  dtype='int64'))
        tm.assert_index_equal(
            rng.microseconds,
            Index([100 * 1000 + 123, 100 * 1000 + 123], dtype='int64'))
        tm.assert_index_equal(rng.nanoseconds,
                              Index([456, 456], dtype='int64'))

        pytest.raises(AttributeError, lambda: rng.hours)
        pytest.raises(AttributeError, lambda: rng.minutes)
        pytest.raises(AttributeError, lambda: rng.milliseconds)

        # with nat
        s = Series(rng)
        s[1] = np.nan

        tm.assert_series_equal(s.dt.days, Series([1, np.nan], index=[0, 1]))
        tm.assert_series_equal(s.dt.seconds, Series(
            [10 * 3600 + 11 * 60 + 12, np.nan], index=[0, 1]))

        # preserve name (GH15589)
        rng.name = 'name'
        assert rng.days.name == 'name'

    def test_freq_conversion(self):

        # doc example

        # series
        td = Series(date_range('20130101', periods=4)) - \
            Series(date_range('20121201', periods=4))
        td[2] += timedelta(minutes=5, seconds=3)
        td[3] = np.nan

        result = td / np.timedelta64(1, 'D')
        expected = Series([31, 31, (31 * 86400 + 5 * 60 + 3) / 86400.0, np.nan
                           ])
        assert_series_equal(result, expected)

        result = td.astype('timedelta64[D]')
        expected = Series([31, 31, 31, np.nan])
        assert_series_equal(result, expected)

        result = td / np.timedelta64(1, 's')
        expected = Series([31 * 86400, 31 * 86400, 31 * 86400 + 5 * 60 + 3,
                           np.nan])
        assert_series_equal(result, expected)

        result = td.astype('timedelta64[s]')
        assert_series_equal(result, expected)

        # tdi
        td = TimedeltaIndex(td)

        result = td / np.timedelta64(1, 'D')
        expected = Index([31, 31, (31 * 86400 + 5 * 60 + 3) / 86400.0, np.nan])
        assert_index_equal(result, expected)

        result = td.astype('timedelta64[D]')
        expected = Index([31, 31, 31, np.nan])
        assert_index_equal(result, expected)

        result = td / np.timedelta64(1, 's')
        expected = Index([31 * 86400, 31 * 86400, 31 * 86400 + 5 * 60 + 3,
                          np.nan])
        assert_index_equal(result, expected)

        result = td.astype('timedelta64[s]')
        assert_index_equal(result, expected)


class TestSlicing(object):

    def test_timedelta(self):
        # this is valid too
        index = date_range('1/1/2000', periods=50, freq='B')
        shifted = index + timedelta(1)
        back = shifted + timedelta(-1)
        assert tm.equalContents(index, back)
        assert shifted.freq == index.freq
        assert shifted.freq == back.freq

        result = index - timedelta(1)
        expected = index + timedelta(-1)
        tm.assert_index_equal(result, expected)

        # GH4134, buggy with timedeltas
        rng = date_range('2013', '2014')
        s = Series(rng)
        result1 = rng - pd.offsets.Hour(1)
        result2 = DatetimeIndex(s - np.timedelta64(100000000))
        result3 = rng - np.timedelta64(100000000)
        result4 = DatetimeIndex(s - pd.offsets.Hour(1))
        tm.assert_index_equal(result1, result4)
        tm.assert_index_equal(result2, result3)


class TestTimeSeries(object):
    _multiprocess_can_split_ = True

    def test_series_box_timedelta(self):
        rng = timedelta_range('1 day 1 s', periods=5, freq='h')
        s = Series(rng)
        assert isinstance(s[1], Timedelta)
        assert isinstance(s.iat[2], Timedelta)
