import pytest

import numpy as np
from numpy.random import randn
from datetime import timedelta

import pandas as pd
from pandas.util import testing as tm
from pandas import (PeriodIndex, period_range, notnull, DatetimeIndex, NaT,
                    Index, Period, Int64Index, Series, DataFrame, date_range,
                    offsets, compat)

from ..datetimelike import DatetimeLike


class TestPeriodIndex(DatetimeLike):
    _holder = PeriodIndex
    _multiprocess_can_split_ = True

    def setup_method(self, method):
        self.indices = dict(index=tm.makePeriodIndex(10))
        self.setup_indices()

    def create_index(self):
        return period_range('20130101', periods=5, freq='D')

    def test_astype(self):
        # GH 13149, GH 13209
        idx = PeriodIndex(['2016-05-16', 'NaT', NaT, np.NaN], freq='D')

        result = idx.astype(object)
        expected = Index([Period('2016-05-16', freq='D')] +
                         [Period(NaT, freq='D')] * 3, dtype='object')
        tm.assert_index_equal(result, expected)

        result = idx.astype(int)
        expected = Int64Index([16937] + [-9223372036854775808] * 3,
                              dtype=np.int64)
        tm.assert_index_equal(result, expected)

        idx = period_range('1990', '2009', freq='A')
        result = idx.astype('i8')
        tm.assert_index_equal(result, Index(idx.asi8))
        tm.assert_numpy_array_equal(result.values, idx.asi8)

    def test_astype_raises(self):
        # GH 13149, GH 13209
        idx = PeriodIndex(['2016-05-16', 'NaT', NaT, np.NaN], freq='D')

        pytest.raises(ValueError, idx.astype, str)
        pytest.raises(ValueError, idx.astype, float)
        pytest.raises(ValueError, idx.astype, 'timedelta64')
        pytest.raises(ValueError, idx.astype, 'timedelta64[ns]')

    def test_pickle_compat_construction(self):
        pass

    def test_pickle_round_trip(self):
        for freq in ['D', 'M', 'A']:
            idx = PeriodIndex(['2016-05-16', 'NaT', NaT, np.NaN], freq=freq)
            result = tm.round_trip_pickle(idx)
            tm.assert_index_equal(result, idx)

    def test_get_loc(self):
        idx = pd.period_range('2000-01-01', periods=3)

        for method in [None, 'pad', 'backfill', 'nearest']:
            assert idx.get_loc(idx[1], method) == 1
            assert idx.get_loc(idx[1].asfreq('H', how='start'), method) == 1
            assert idx.get_loc(idx[1].to_timestamp(), method) == 1
            assert idx.get_loc(idx[1].to_timestamp()
                               .to_pydatetime(), method) == 1
            assert idx.get_loc(str(idx[1]), method) == 1

        idx = pd.period_range('2000-01-01', periods=5)[::2]
        assert idx.get_loc('2000-01-02T12', method='nearest',
                           tolerance='1 day') == 1
        assert idx.get_loc('2000-01-02T12', method='nearest',
                           tolerance=pd.Timedelta('1D')) == 1
        assert idx.get_loc('2000-01-02T12', method='nearest',
                           tolerance=np.timedelta64(1, 'D')) == 1
        assert idx.get_loc('2000-01-02T12', method='nearest',
                           tolerance=timedelta(1)) == 1
        with tm.assert_raises_regex(ValueError, 'must be convertible'):
            idx.get_loc('2000-01-10', method='nearest', tolerance='foo')

        msg = 'Input has different freq from PeriodIndex\\(freq=D\\)'
        with tm.assert_raises_regex(ValueError, msg):
            idx.get_loc('2000-01-10', method='nearest', tolerance='1 hour')
        with pytest.raises(KeyError):
            idx.get_loc('2000-01-10', method='nearest', tolerance='1 day')

    def test_where(self):
        i = self.create_index()
        result = i.where(notnull(i))
        expected = i
        tm.assert_index_equal(result, expected)

        i2 = pd.PeriodIndex([pd.NaT, pd.NaT] + i[2:].tolist(),
                            freq='D')
        result = i.where(notnull(i2))
        expected = i2
        tm.assert_index_equal(result, expected)

    def test_where_array_like(self):
        i = self.create_index()
        cond = [False] + [True] * (len(i) - 1)
        klasses = [list, tuple, np.array, Series]
        expected = pd.PeriodIndex([pd.NaT] + i[1:].tolist(), freq='D')

        for klass in klasses:
            result = i.where(klass(cond))
            tm.assert_index_equal(result, expected)

    def test_where_other(self):

        i = self.create_index()
        for arr in [np.nan, pd.NaT]:
            result = i.where(notnull(i), other=np.nan)
            expected = i
            tm.assert_index_equal(result, expected)

        i2 = i.copy()
        i2 = pd.PeriodIndex([pd.NaT, pd.NaT] + i[2:].tolist(),
                            freq='D')
        result = i.where(notnull(i2), i2)
        tm.assert_index_equal(result, i2)

        i2 = i.copy()
        i2 = pd.PeriodIndex([pd.NaT, pd.NaT] + i[2:].tolist(),
                            freq='D')
        result = i.where(notnull(i2), i2.values)
        tm.assert_index_equal(result, i2)

    def test_get_indexer(self):
        idx = pd.period_range('2000-01-01', periods=3).asfreq('H', how='start')
        tm.assert_numpy_array_equal(idx.get_indexer(idx),
                                    np.array([0, 1, 2], dtype=np.intp))

        target = pd.PeriodIndex(['1999-12-31T23', '2000-01-01T12',
                                 '2000-01-02T01'], freq='H')
        tm.assert_numpy_array_equal(idx.get_indexer(target, 'pad'),
                                    np.array([-1, 0, 1], dtype=np.intp))
        tm.assert_numpy_array_equal(idx.get_indexer(target, 'backfill'),
                                    np.array([0, 1, 2], dtype=np.intp))
        tm.assert_numpy_array_equal(idx.get_indexer(target, 'nearest'),
                                    np.array([0, 1, 1], dtype=np.intp))
        tm.assert_numpy_array_equal(idx.get_indexer(target, 'nearest',
                                                    tolerance='1 hour'),
                                    np.array([0, -1, 1], dtype=np.intp))

        msg = 'Input has different freq from PeriodIndex\\(freq=H\\)'
        with tm.assert_raises_regex(ValueError, msg):
            idx.get_indexer(target, 'nearest', tolerance='1 minute')

        tm.assert_numpy_array_equal(idx.get_indexer(target, 'nearest',
                                                    tolerance='1 day'),
                                    np.array([0, 1, 1], dtype=np.intp))

    def test_repeat(self):
        # GH10183
        idx = pd.period_range('2000-01-01', periods=3, freq='D')
        res = idx.repeat(3)
        exp = PeriodIndex(idx.values.repeat(3), freq='D')
        tm.assert_index_equal(res, exp)
        assert res.freqstr == 'D'

    def test_period_index_indexer(self):
        # GH4125
        idx = pd.period_range('2002-01', '2003-12', freq='M')
        df = pd.DataFrame(pd.np.random.randn(24, 10), index=idx)
        tm.assert_frame_equal(df, df.loc[idx])
        tm.assert_frame_equal(df, df.loc[list(idx)])
        tm.assert_frame_equal(df, df.loc[list(idx)])
        tm.assert_frame_equal(df.iloc[0:5], df.loc[idx[0:5]])
        tm.assert_frame_equal(df, df.loc[list(idx)])

    def test_fillna_period(self):
        # GH 11343
        idx = pd.PeriodIndex(['2011-01-01 09:00', pd.NaT,
                              '2011-01-01 11:00'], freq='H')

        exp = pd.PeriodIndex(['2011-01-01 09:00', '2011-01-01 10:00',
                              '2011-01-01 11:00'], freq='H')
        tm.assert_index_equal(
            idx.fillna(pd.Period('2011-01-01 10:00', freq='H')), exp)

        exp = pd.Index([pd.Period('2011-01-01 09:00', freq='H'), 'x',
                        pd.Period('2011-01-01 11:00', freq='H')], dtype=object)
        tm.assert_index_equal(idx.fillna('x'), exp)

        exp = pd.Index([pd.Period('2011-01-01 09:00', freq='H'),
                        pd.Period('2011-01-01', freq='D'),
                        pd.Period('2011-01-01 11:00', freq='H')], dtype=object)
        tm.assert_index_equal(idx.fillna(
            pd.Period('2011-01-01', freq='D')), exp)

    def test_no_millisecond_field(self):
        with pytest.raises(AttributeError):
            DatetimeIndex.millisecond

        with pytest.raises(AttributeError):
            DatetimeIndex([]).millisecond

    def test_difference_freq(self):
        # GH14323: difference of Period MUST preserve frequency
        # but the ability to union results must be preserved

        index = period_range("20160920", "20160925", freq="D")

        other = period_range("20160921", "20160924", freq="D")
        expected = PeriodIndex(["20160920", "20160925"], freq='D')
        idx_diff = index.difference(other)
        tm.assert_index_equal(idx_diff, expected)
        tm.assert_attr_equal('freq', idx_diff, expected)

        other = period_range("20160922", "20160925", freq="D")
        idx_diff = index.difference(other)
        expected = PeriodIndex(["20160920", "20160921"], freq='D')
        tm.assert_index_equal(idx_diff, expected)
        tm.assert_attr_equal('freq', idx_diff, expected)

    def test_hash_error(self):
        index = period_range('20010101', periods=10)
        with tm.assert_raises_regex(TypeError, "unhashable type: %r" %
                                    type(index).__name__):
            hash(index)

    def test_make_time_series(self):
        index = PeriodIndex(freq='A', start='1/1/2001', end='12/1/2009')
        series = Series(1, index=index)
        assert isinstance(series, Series)

    def test_shallow_copy_empty(self):

        # GH13067
        idx = PeriodIndex([], freq='M')
        result = idx._shallow_copy()
        expected = idx

        tm.assert_index_equal(result, expected)

    def test_dtype_str(self):
        pi = pd.PeriodIndex([], freq='M')
        assert pi.dtype_str == 'period[M]'
        assert pi.dtype_str == str(pi.dtype)

        pi = pd.PeriodIndex([], freq='3M')
        assert pi.dtype_str == 'period[3M]'
        assert pi.dtype_str == str(pi.dtype)

    def test_view_asi8(self):
        idx = pd.PeriodIndex([], freq='M')

        exp = np.array([], dtype=np.int64)
        tm.assert_numpy_array_equal(idx.view('i8'), exp)
        tm.assert_numpy_array_equal(idx.asi8, exp)

        idx = pd.PeriodIndex(['2011-01', pd.NaT], freq='M')

        exp = np.array([492, -9223372036854775808], dtype=np.int64)
        tm.assert_numpy_array_equal(idx.view('i8'), exp)
        tm.assert_numpy_array_equal(idx.asi8, exp)

        exp = np.array([14975, -9223372036854775808], dtype=np.int64)
        idx = pd.PeriodIndex(['2011-01-01', pd.NaT], freq='D')
        tm.assert_numpy_array_equal(idx.view('i8'), exp)
        tm.assert_numpy_array_equal(idx.asi8, exp)

    def test_values(self):
        idx = pd.PeriodIndex([], freq='M')

        exp = np.array([], dtype=np.object)
        tm.assert_numpy_array_equal(idx.values, exp)
        tm.assert_numpy_array_equal(idx.get_values(), exp)
        exp = np.array([], dtype=np.int64)
        tm.assert_numpy_array_equal(idx._values, exp)

        idx = pd.PeriodIndex(['2011-01', pd.NaT], freq='M')

        exp = np.array([pd.Period('2011-01', freq='M'), pd.NaT], dtype=object)
        tm.assert_numpy_array_equal(idx.values, exp)
        tm.assert_numpy_array_equal(idx.get_values(), exp)
        exp = np.array([492, -9223372036854775808], dtype=np.int64)
        tm.assert_numpy_array_equal(idx._values, exp)

        idx = pd.PeriodIndex(['2011-01-01', pd.NaT], freq='D')

        exp = np.array([pd.Period('2011-01-01', freq='D'), pd.NaT],
                       dtype=object)
        tm.assert_numpy_array_equal(idx.values, exp)
        tm.assert_numpy_array_equal(idx.get_values(), exp)
        exp = np.array([14975, -9223372036854775808], dtype=np.int64)
        tm.assert_numpy_array_equal(idx._values, exp)

    def test_period_index_length(self):
        pi = PeriodIndex(freq='A', start='1/1/2001', end='12/1/2009')
        assert len(pi) == 9

        pi = PeriodIndex(freq='Q', start='1/1/2001', end='12/1/2009')
        assert len(pi) == 4 * 9

        pi = PeriodIndex(freq='M', start='1/1/2001', end='12/1/2009')
        assert len(pi) == 12 * 9

        start = Period('02-Apr-2005', 'B')
        i1 = PeriodIndex(start=start, periods=20)
        assert len(i1) == 20
        assert i1.freq == start.freq
        assert i1[0] == start

        end_intv = Period('2006-12-31', 'W')
        i1 = PeriodIndex(end=end_intv, periods=10)
        assert len(i1) == 10
        assert i1.freq == end_intv.freq
        assert i1[-1] == end_intv

        end_intv = Period('2006-12-31', '1w')
        i2 = PeriodIndex(end=end_intv, periods=10)
        assert len(i1) == len(i2)
        assert (i1 == i2).all()
        assert i1.freq == i2.freq

        end_intv = Period('2006-12-31', ('w', 1))
        i2 = PeriodIndex(end=end_intv, periods=10)
        assert len(i1) == len(i2)
        assert (i1 == i2).all()
        assert i1.freq == i2.freq

        try:
            PeriodIndex(start=start, end=end_intv)
            raise AssertionError('Cannot allow mixed freq for start and end')
        except ValueError:
            pass

        end_intv = Period('2005-05-01', 'B')
        i1 = PeriodIndex(start=start, end=end_intv)

        try:
            PeriodIndex(start=start)
            raise AssertionError(
                'Must specify periods if missing start or end')
        except ValueError:
            pass

        # infer freq from first element
        i2 = PeriodIndex([end_intv, Period('2005-05-05', 'B')])
        assert len(i2) == 2
        assert i2[0] == end_intv

        i2 = PeriodIndex(np.array([end_intv, Period('2005-05-05', 'B')]))
        assert len(i2) == 2
        assert i2[0] == end_intv

        # Mixed freq should fail
        vals = [end_intv, Period('2006-12-31', 'w')]
        pytest.raises(ValueError, PeriodIndex, vals)
        vals = np.array(vals)
        pytest.raises(ValueError, PeriodIndex, vals)

    def test_fields(self):
        # year, month, day, hour, minute
        # second, weekofyear, week, dayofweek, weekday, dayofyear, quarter
        # qyear
        pi = PeriodIndex(freq='A', start='1/1/2001', end='12/1/2005')
        self._check_all_fields(pi)

        pi = PeriodIndex(freq='Q', start='1/1/2001', end='12/1/2002')
        self._check_all_fields(pi)

        pi = PeriodIndex(freq='M', start='1/1/2001', end='1/1/2002')
        self._check_all_fields(pi)

        pi = PeriodIndex(freq='D', start='12/1/2001', end='6/1/2001')
        self._check_all_fields(pi)

        pi = PeriodIndex(freq='B', start='12/1/2001', end='6/1/2001')
        self._check_all_fields(pi)

        pi = PeriodIndex(freq='H', start='12/31/2001', end='1/1/2002 23:00')
        self._check_all_fields(pi)

        pi = PeriodIndex(freq='Min', start='12/31/2001', end='1/1/2002 00:20')
        self._check_all_fields(pi)

        pi = PeriodIndex(freq='S', start='12/31/2001 00:00:00',
                         end='12/31/2001 00:05:00')
        self._check_all_fields(pi)

        end_intv = Period('2006-12-31', 'W')
        i1 = PeriodIndex(end=end_intv, periods=10)
        self._check_all_fields(i1)

    def _check_all_fields(self, periodindex):
        fields = ['year', 'month', 'day', 'hour', 'minute', 'second',
                  'weekofyear', 'week', 'dayofweek', 'dayofyear',
                  'quarter', 'qyear', 'days_in_month']

        periods = list(periodindex)
        s = pd.Series(periodindex)

        for field in fields:
            field_idx = getattr(periodindex, field)
            assert len(periodindex) == len(field_idx)
            for x, val in zip(periods, field_idx):
                assert getattr(x, field) == val

            if len(s) == 0:
                continue

            field_s = getattr(s.dt, field)
            assert len(periodindex) == len(field_s)
            for x, val in zip(periods, field_s):
                assert getattr(x, field) == val

    def test_indexing(self):

        # GH 4390, iat incorrectly indexing
        index = period_range('1/1/2001', periods=10)
        s = Series(randn(10), index=index)
        expected = s[index[0]]
        result = s.iat[0]
        assert expected == result

    def test_period_set_index_reindex(self):
        # GH 6631
        df = DataFrame(np.random.random(6))
        idx1 = period_range('2011/01/01', periods=6, freq='M')
        idx2 = period_range('2013', periods=6, freq='A')

        df = df.set_index(idx1)
        tm.assert_index_equal(df.index, idx1)
        df = df.set_index(idx2)
        tm.assert_index_equal(df.index, idx2)

    def test_factorize(self):
        idx1 = PeriodIndex(['2014-01', '2014-01', '2014-02', '2014-02',
                            '2014-03', '2014-03'], freq='M')

        exp_arr = np.array([0, 0, 1, 1, 2, 2], dtype=np.intp)
        exp_idx = PeriodIndex(['2014-01', '2014-02', '2014-03'], freq='M')

        arr, idx = idx1.factorize()
        tm.assert_numpy_array_equal(arr, exp_arr)
        tm.assert_index_equal(idx, exp_idx)

        arr, idx = idx1.factorize(sort=True)
        tm.assert_numpy_array_equal(arr, exp_arr)
        tm.assert_index_equal(idx, exp_idx)

        idx2 = pd.PeriodIndex(['2014-03', '2014-03', '2014-02', '2014-01',
                               '2014-03', '2014-01'], freq='M')

        exp_arr = np.array([2, 2, 1, 0, 2, 0], dtype=np.intp)
        arr, idx = idx2.factorize(sort=True)
        tm.assert_numpy_array_equal(arr, exp_arr)
        tm.assert_index_equal(idx, exp_idx)

        exp_arr = np.array([0, 0, 1, 2, 0, 2], dtype=np.intp)
        exp_idx = PeriodIndex(['2014-03', '2014-02', '2014-01'], freq='M')
        arr, idx = idx2.factorize()
        tm.assert_numpy_array_equal(arr, exp_arr)
        tm.assert_index_equal(idx, exp_idx)

    def test_asobject_like(self):
        idx = pd.PeriodIndex([], freq='M')

        exp = np.array([], dtype=object)
        tm.assert_numpy_array_equal(idx.asobject.values, exp)
        tm.assert_numpy_array_equal(idx._mpl_repr(), exp)

        idx = pd.PeriodIndex(['2011-01', pd.NaT], freq='M')

        exp = np.array([pd.Period('2011-01', freq='M'), pd.NaT], dtype=object)
        tm.assert_numpy_array_equal(idx.asobject.values, exp)
        tm.assert_numpy_array_equal(idx._mpl_repr(), exp)

        exp = np.array([pd.Period('2011-01-01', freq='D'), pd.NaT],
                       dtype=object)
        idx = pd.PeriodIndex(['2011-01-01', pd.NaT], freq='D')
        tm.assert_numpy_array_equal(idx.asobject.values, exp)
        tm.assert_numpy_array_equal(idx._mpl_repr(), exp)

    def test_is_(self):
        create_index = lambda: PeriodIndex(freq='A', start='1/1/2001',
                                           end='12/1/2009')
        index = create_index()
        assert index.is_(index)
        assert not index.is_(create_index())
        assert index.is_(index.view())
        assert index.is_(index.view().view().view().view().view())
        assert index.view().is_(index)
        ind2 = index.view()
        index.name = "Apple"
        assert ind2.is_(index)
        assert not index.is_(index[:])
        assert not index.is_(index.asfreq('M'))
        assert not index.is_(index.asfreq('A'))
        assert not index.is_(index - 2)
        assert not index.is_(index - 0)

    def test_comp_period(self):
        idx = period_range('2007-01', periods=20, freq='M')

        result = idx < idx[10]
        exp = idx.values < idx.values[10]
        tm.assert_numpy_array_equal(result, exp)

    def test_contains(self):
        rng = period_range('2007-01', freq='M', periods=10)

        assert Period('2007-01', freq='M') in rng
        assert not Period('2007-01', freq='D') in rng
        assert not Period('2007-01', freq='2M') in rng

    def test_contains_nat(self):
        # see gh-13582
        idx = period_range('2007-01', freq='M', periods=10)
        assert pd.NaT not in idx
        assert None not in idx
        assert float('nan') not in idx
        assert np.nan not in idx

        idx = pd.PeriodIndex(['2011-01', 'NaT', '2011-02'], freq='M')
        assert pd.NaT in idx
        assert None in idx
        assert float('nan') in idx
        assert np.nan in idx

    def test_periods_number_check(self):
        with pytest.raises(ValueError):
            period_range('2011-1-1', '2012-1-1', 'B')

    def test_start_time(self):
        index = PeriodIndex(freq='M', start='2016-01-01', end='2016-05-31')
        expected_index = date_range('2016-01-01', end='2016-05-31', freq='MS')
        tm.assert_index_equal(index.start_time, expected_index)

    def test_end_time(self):
        index = PeriodIndex(freq='M', start='2016-01-01', end='2016-05-31')
        expected_index = date_range('2016-01-01', end='2016-05-31', freq='M')
        tm.assert_index_equal(index.end_time, expected_index)

    def test_index_duplicate_periods(self):
        # monotonic
        idx = PeriodIndex([2000, 2007, 2007, 2009, 2009], freq='A-JUN')
        ts = Series(np.random.randn(len(idx)), index=idx)

        result = ts[2007]
        expected = ts[1:3]
        tm.assert_series_equal(result, expected)
        result[:] = 1
        assert (ts[1:3] == 1).all()

        # not monotonic
        idx = PeriodIndex([2000, 2007, 2007, 2009, 2007], freq='A-JUN')
        ts = Series(np.random.randn(len(idx)), index=idx)

        result = ts[2007]
        expected = ts[idx == 2007]
        tm.assert_series_equal(result, expected)

    def test_index_unique(self):
        idx = PeriodIndex([2000, 2007, 2007, 2009, 2009], freq='A-JUN')
        expected = PeriodIndex([2000, 2007, 2009], freq='A-JUN')
        tm.assert_index_equal(idx.unique(), expected)
        assert idx.nunique() == 3

        idx = PeriodIndex([2000, 2007, 2007, 2009, 2007], freq='A-JUN',
                          tz='US/Eastern')
        expected = PeriodIndex([2000, 2007, 2009], freq='A-JUN',
                               tz='US/Eastern')
        tm.assert_index_equal(idx.unique(), expected)
        assert idx.nunique() == 3

    def test_shift_gh8083(self):

        # test shift for PeriodIndex
        # GH8083
        drange = self.create_index()
        result = drange.shift(1)
        expected = PeriodIndex(['2013-01-02', '2013-01-03', '2013-01-04',
                                '2013-01-05', '2013-01-06'], freq='D')
        tm.assert_index_equal(result, expected)

    def test_shift(self):
        pi1 = PeriodIndex(freq='A', start='1/1/2001', end='12/1/2009')
        pi2 = PeriodIndex(freq='A', start='1/1/2002', end='12/1/2010')

        tm.assert_index_equal(pi1.shift(0), pi1)

        assert len(pi1) == len(pi2)
        tm.assert_index_equal(pi1.shift(1), pi2)

        pi1 = PeriodIndex(freq='A', start='1/1/2001', end='12/1/2009')
        pi2 = PeriodIndex(freq='A', start='1/1/2000', end='12/1/2008')
        assert len(pi1) == len(pi2)
        tm.assert_index_equal(pi1.shift(-1), pi2)

        pi1 = PeriodIndex(freq='M', start='1/1/2001', end='12/1/2009')
        pi2 = PeriodIndex(freq='M', start='2/1/2001', end='1/1/2010')
        assert len(pi1) == len(pi2)
        tm.assert_index_equal(pi1.shift(1), pi2)

        pi1 = PeriodIndex(freq='M', start='1/1/2001', end='12/1/2009')
        pi2 = PeriodIndex(freq='M', start='12/1/2000', end='11/1/2009')
        assert len(pi1) == len(pi2)
        tm.assert_index_equal(pi1.shift(-1), pi2)

        pi1 = PeriodIndex(freq='D', start='1/1/2001', end='12/1/2009')
        pi2 = PeriodIndex(freq='D', start='1/2/2001', end='12/2/2009')
        assert len(pi1) == len(pi2)
        tm.assert_index_equal(pi1.shift(1), pi2)

        pi1 = PeriodIndex(freq='D', start='1/1/2001', end='12/1/2009')
        pi2 = PeriodIndex(freq='D', start='12/31/2000', end='11/30/2009')
        assert len(pi1) == len(pi2)
        tm.assert_index_equal(pi1.shift(-1), pi2)

    def test_shift_nat(self):
        idx = PeriodIndex(['2011-01', '2011-02', 'NaT',
                           '2011-04'], freq='M', name='idx')
        result = idx.shift(1)
        expected = PeriodIndex(['2011-02', '2011-03', 'NaT',
                                '2011-05'], freq='M', name='idx')
        tm.assert_index_equal(result, expected)
        assert result.name == expected.name

    def test_ndarray_compat_properties(self):
        if compat.is_platform_32bit():
            pytest.skip("skipping on 32bit")
        super(TestPeriodIndex, self).test_ndarray_compat_properties()

    def test_shift_ndarray(self):
        idx = PeriodIndex(['2011-01', '2011-02', 'NaT',
                           '2011-04'], freq='M', name='idx')
        result = idx.shift(np.array([1, 2, 3, 4]))
        expected = PeriodIndex(['2011-02', '2011-04', 'NaT',
                                '2011-08'], freq='M', name='idx')
        tm.assert_index_equal(result, expected)

        idx = PeriodIndex(['2011-01', '2011-02', 'NaT',
                           '2011-04'], freq='M', name='idx')
        result = idx.shift(np.array([1, -2, 3, -4]))
        expected = PeriodIndex(['2011-02', '2010-12', 'NaT',
                                '2010-12'], freq='M', name='idx')
        tm.assert_index_equal(result, expected)

    def test_negative_ordinals(self):
        Period(ordinal=-1000, freq='A')
        Period(ordinal=0, freq='A')

        idx1 = PeriodIndex(ordinal=[-1, 0, 1], freq='A')
        idx2 = PeriodIndex(ordinal=np.array([-1, 0, 1]), freq='A')
        tm.assert_index_equal(idx1, idx2)

    def test_pindex_fieldaccessor_nat(self):
        idx = PeriodIndex(['2011-01', '2011-02', 'NaT',
                           '2012-03', '2012-04'], freq='D', name='name')

        exp = Index([2011, 2011, -1, 2012, 2012], dtype=np.int64, name='name')
        tm.assert_index_equal(idx.year, exp)
        exp = Index([1, 2, -1, 3, 4], dtype=np.int64, name='name')
        tm.assert_index_equal(idx.month, exp)

    def test_pindex_qaccess(self):
        pi = PeriodIndex(['2Q05', '3Q05', '4Q05', '1Q06', '2Q06'], freq='Q')
        s = Series(np.random.rand(len(pi)), index=pi).cumsum()
        # Todo: fix these accessors!
        assert s['05Q4'] == s[2]

    def test_numpy_repeat(self):
        index = period_range('20010101', periods=2)
        expected = PeriodIndex([Period('2001-01-01'), Period('2001-01-01'),
                                Period('2001-01-02'), Period('2001-01-02')])

        tm.assert_index_equal(np.repeat(index, 2), expected)

        msg = "the 'axis' parameter is not supported"
        tm.assert_raises_regex(
            ValueError, msg, np.repeat, index, 2, axis=1)

    def test_pindex_multiples(self):
        pi = PeriodIndex(start='1/1/11', end='12/31/11', freq='2M')
        expected = PeriodIndex(['2011-01', '2011-03', '2011-05', '2011-07',
                                '2011-09', '2011-11'], freq='2M')
        tm.assert_index_equal(pi, expected)
        assert pi.freq == offsets.MonthEnd(2)
        assert pi.freqstr == '2M'

        pi = period_range(start='1/1/11', end='12/31/11', freq='2M')
        tm.assert_index_equal(pi, expected)
        assert pi.freq == offsets.MonthEnd(2)
        assert pi.freqstr == '2M'

        pi = period_range(start='1/1/11', periods=6, freq='2M')
        tm.assert_index_equal(pi, expected)
        assert pi.freq == offsets.MonthEnd(2)
        assert pi.freqstr == '2M'

    def test_iteration(self):
        index = PeriodIndex(start='1/1/10', periods=4, freq='B')

        result = list(index)
        assert isinstance(result[0], Period)
        assert result[0].freq == index.freq

    def test_is_full(self):
        index = PeriodIndex([2005, 2007, 2009], freq='A')
        assert not index.is_full

        index = PeriodIndex([2005, 2006, 2007], freq='A')
        assert index.is_full

        index = PeriodIndex([2005, 2005, 2007], freq='A')
        assert not index.is_full

        index = PeriodIndex([2005, 2005, 2006], freq='A')
        assert index.is_full

        index = PeriodIndex([2006, 2005, 2005], freq='A')
        pytest.raises(ValueError, getattr, index, 'is_full')

        assert index[:0].is_full

    def test_with_multi_index(self):
        # #1705
        index = date_range('1/1/2012', periods=4, freq='12H')
        index_as_arrays = [index.to_period(freq='D'), index.hour]

        s = Series([0, 1, 2, 3], index_as_arrays)

        assert isinstance(s.index.levels[0], PeriodIndex)

        assert isinstance(s.index.values[0][0], Period)

    def test_convert_array_of_periods(self):
        rng = period_range('1/1/2000', periods=20, freq='D')
        periods = list(rng)

        result = pd.Index(periods)
        assert isinstance(result, PeriodIndex)

    def test_append_concat(self):
        # #1815
        d1 = date_range('12/31/1990', '12/31/1999', freq='A-DEC')
        d2 = date_range('12/31/2000', '12/31/2009', freq='A-DEC')

        s1 = Series(np.random.randn(10), d1)
        s2 = Series(np.random.randn(10), d2)

        s1 = s1.to_period()
        s2 = s2.to_period()

        # drops index
        result = pd.concat([s1, s2])
        assert isinstance(result.index, PeriodIndex)
        assert result.index[0] == s1.index[0]

    def test_pickle_freq(self):
        # GH2891
        prng = period_range('1/1/2011', '1/1/2012', freq='M')
        new_prng = tm.round_trip_pickle(prng)
        assert new_prng.freq == offsets.MonthEnd()
        assert new_prng.freqstr == 'M'

    def test_map(self):
        index = PeriodIndex([2005, 2007, 2009], freq='A')
        result = index.map(lambda x: x + 1)
        expected = index + 1
        tm.assert_index_equal(result, expected)

        result = index.map(lambda x: x.ordinal)
        exp = Index([x.ordinal for x in index])
        tm.assert_index_equal(result, exp)
