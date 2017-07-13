import pytest

import numpy as np
from datetime import timedelta

import pandas as pd
import pandas._libs.tslib as tslib
import pandas.util.testing as tm
import pandas.core.indexes.period as period
from pandas import (DatetimeIndex, PeriodIndex, period_range, Series, Period,
                    _np_version_under1p10, Index, Timedelta, offsets)

from pandas.tests.test_base import Ops


class TestPeriodIndexOps(Ops):

    def setup_method(self, method):
        super(TestPeriodIndexOps, self).setup_method(method)
        mask = lambda x: (isinstance(x, DatetimeIndex) or
                          isinstance(x, PeriodIndex))
        self.is_valid_objs = [o for o in self.objs if mask(o)]
        self.not_valid_objs = [o for o in self.objs if not mask(o)]

    def test_ops_properties(self):
        f = lambda x: isinstance(x, PeriodIndex)
        self.check_ops_properties(PeriodIndex._field_ops, f)
        self.check_ops_properties(PeriodIndex._object_ops, f)
        self.check_ops_properties(PeriodIndex._bool_ops, f)

    def test_asobject_tolist(self):
        idx = pd.period_range(start='2013-01-01', periods=4, freq='M',
                              name='idx')
        expected_list = [pd.Period('2013-01-31', freq='M'),
                         pd.Period('2013-02-28', freq='M'),
                         pd.Period('2013-03-31', freq='M'),
                         pd.Period('2013-04-30', freq='M')]
        expected = pd.Index(expected_list, dtype=object, name='idx')
        result = idx.asobject
        assert isinstance(result, Index)
        assert result.dtype == object
        tm.assert_index_equal(result, expected)
        assert result.name == expected.name
        assert idx.tolist() == expected_list

        idx = PeriodIndex(['2013-01-01', '2013-01-02', 'NaT',
                           '2013-01-04'], freq='D', name='idx')
        expected_list = [pd.Period('2013-01-01', freq='D'),
                         pd.Period('2013-01-02', freq='D'),
                         pd.Period('NaT', freq='D'),
                         pd.Period('2013-01-04', freq='D')]
        expected = pd.Index(expected_list, dtype=object, name='idx')
        result = idx.asobject
        assert isinstance(result, Index)
        assert result.dtype == object
        tm.assert_index_equal(result, expected)
        for i in [0, 1, 3]:
            assert result[i] == expected[i]
        assert result[2] is pd.NaT
        assert result.name == expected.name

        result_list = idx.tolist()
        for i in [0, 1, 3]:
            assert result_list[i] == expected_list[i]
        assert result_list[2] is pd.NaT

    def test_minmax(self):

        # monotonic
        idx1 = pd.PeriodIndex([pd.NaT, '2011-01-01', '2011-01-02',
                               '2011-01-03'], freq='D')
        assert idx1.is_monotonic

        # non-monotonic
        idx2 = pd.PeriodIndex(['2011-01-01', pd.NaT, '2011-01-03',
                               '2011-01-02', pd.NaT], freq='D')
        assert not idx2.is_monotonic

        for idx in [idx1, idx2]:
            assert idx.min() == pd.Period('2011-01-01', freq='D')
            assert idx.max() == pd.Period('2011-01-03', freq='D')
        assert idx1.argmin() == 1
        assert idx2.argmin() == 0
        assert idx1.argmax() == 3
        assert idx2.argmax() == 2

        for op in ['min', 'max']:
            # Return NaT
            obj = PeriodIndex([], freq='M')
            result = getattr(obj, op)()
            assert result is tslib.NaT

            obj = PeriodIndex([pd.NaT], freq='M')
            result = getattr(obj, op)()
            assert result is tslib.NaT

            obj = PeriodIndex([pd.NaT, pd.NaT, pd.NaT], freq='M')
            result = getattr(obj, op)()
            assert result is tslib.NaT

    def test_numpy_minmax(self):
        pr = pd.period_range(start='2016-01-15', end='2016-01-20')

        assert np.min(pr) == Period('2016-01-15', freq='D')
        assert np.max(pr) == Period('2016-01-20', freq='D')

        errmsg = "the 'out' parameter is not supported"
        tm.assert_raises_regex(ValueError, errmsg, np.min, pr, out=0)
        tm.assert_raises_regex(ValueError, errmsg, np.max, pr, out=0)

        assert np.argmin(pr) == 0
        assert np.argmax(pr) == 5

        if not _np_version_under1p10:
            errmsg = "the 'out' parameter is not supported"
            tm.assert_raises_regex(
                ValueError, errmsg, np.argmin, pr, out=0)
            tm.assert_raises_regex(
                ValueError, errmsg, np.argmax, pr, out=0)

    def test_representation(self):
        # GH 7601
        idx1 = PeriodIndex([], freq='D')
        idx2 = PeriodIndex(['2011-01-01'], freq='D')
        idx3 = PeriodIndex(['2011-01-01', '2011-01-02'], freq='D')
        idx4 = PeriodIndex(['2011-01-01', '2011-01-02', '2011-01-03'],
                           freq='D')
        idx5 = PeriodIndex(['2011', '2012', '2013'], freq='A')
        idx6 = PeriodIndex(['2011-01-01 09:00', '2012-02-01 10:00',
                            'NaT'], freq='H')
        idx7 = pd.period_range('2013Q1', periods=1, freq="Q")
        idx8 = pd.period_range('2013Q1', periods=2, freq="Q")
        idx9 = pd.period_range('2013Q1', periods=3, freq="Q")
        idx10 = PeriodIndex(['2011-01-01', '2011-02-01'], freq='3D')

        exp1 = """PeriodIndex([], dtype='period[D]', freq='D')"""

        exp2 = """PeriodIndex(['2011-01-01'], dtype='period[D]', freq='D')"""

        exp3 = ("PeriodIndex(['2011-01-01', '2011-01-02'], dtype='period[D]', "
                "freq='D')")

        exp4 = ("PeriodIndex(['2011-01-01', '2011-01-02', '2011-01-03'], "
                "dtype='period[D]', freq='D')")

        exp5 = ("PeriodIndex(['2011', '2012', '2013'], dtype='period[A-DEC]', "
                "freq='A-DEC')")

        exp6 = ("PeriodIndex(['2011-01-01 09:00', '2012-02-01 10:00', 'NaT'], "
                "dtype='period[H]', freq='H')")

        exp7 = ("PeriodIndex(['2013Q1'], dtype='period[Q-DEC]', "
                "freq='Q-DEC')")

        exp8 = ("PeriodIndex(['2013Q1', '2013Q2'], dtype='period[Q-DEC]', "
                "freq='Q-DEC')")

        exp9 = ("PeriodIndex(['2013Q1', '2013Q2', '2013Q3'], "
                "dtype='period[Q-DEC]', freq='Q-DEC')")

        exp10 = ("PeriodIndex(['2011-01-01', '2011-02-01'], "
                 "dtype='period[3D]', freq='3D')")

        for idx, expected in zip([idx1, idx2, idx3, idx4, idx5,
                                  idx6, idx7, idx8, idx9, idx10],
                                 [exp1, exp2, exp3, exp4, exp5,
                                  exp6, exp7, exp8, exp9, exp10]):
            for func in ['__repr__', '__unicode__', '__str__']:
                result = getattr(idx, func)()
                assert result == expected

    def test_representation_to_series(self):
        # GH 10971
        idx1 = PeriodIndex([], freq='D')
        idx2 = PeriodIndex(['2011-01-01'], freq='D')
        idx3 = PeriodIndex(['2011-01-01', '2011-01-02'], freq='D')
        idx4 = PeriodIndex(['2011-01-01', '2011-01-02',
                            '2011-01-03'], freq='D')
        idx5 = PeriodIndex(['2011', '2012', '2013'], freq='A')
        idx6 = PeriodIndex(['2011-01-01 09:00', '2012-02-01 10:00',
                            'NaT'], freq='H')

        idx7 = pd.period_range('2013Q1', periods=1, freq="Q")
        idx8 = pd.period_range('2013Q1', periods=2, freq="Q")
        idx9 = pd.period_range('2013Q1', periods=3, freq="Q")

        exp1 = """Series([], dtype: object)"""

        exp2 = """0   2011-01-01
dtype: object"""

        exp3 = """0   2011-01-01
1   2011-01-02
dtype: object"""

        exp4 = """0   2011-01-01
1   2011-01-02
2   2011-01-03
dtype: object"""

        exp5 = """0   2011
1   2012
2   2013
dtype: object"""

        exp6 = """0   2011-01-01 09:00
1   2012-02-01 10:00
2                NaT
dtype: object"""

        exp7 = """0   2013Q1
dtype: object"""

        exp8 = """0   2013Q1
1   2013Q2
dtype: object"""

        exp9 = """0   2013Q1
1   2013Q2
2   2013Q3
dtype: object"""

        for idx, expected in zip([idx1, idx2, idx3, idx4, idx5,
                                  idx6, idx7, idx8, idx9],
                                 [exp1, exp2, exp3, exp4, exp5,
                                  exp6, exp7, exp8, exp9]):
            result = repr(pd.Series(idx))
            assert result == expected

    def test_summary(self):
        # GH9116
        idx1 = PeriodIndex([], freq='D')
        idx2 = PeriodIndex(['2011-01-01'], freq='D')
        idx3 = PeriodIndex(['2011-01-01', '2011-01-02'], freq='D')
        idx4 = PeriodIndex(
            ['2011-01-01', '2011-01-02', '2011-01-03'], freq='D')
        idx5 = PeriodIndex(['2011', '2012', '2013'], freq='A')
        idx6 = PeriodIndex(
            ['2011-01-01 09:00', '2012-02-01 10:00', 'NaT'], freq='H')

        idx7 = pd.period_range('2013Q1', periods=1, freq="Q")
        idx8 = pd.period_range('2013Q1', periods=2, freq="Q")
        idx9 = pd.period_range('2013Q1', periods=3, freq="Q")

        exp1 = """PeriodIndex: 0 entries
Freq: D"""

        exp2 = """PeriodIndex: 1 entries, 2011-01-01 to 2011-01-01
Freq: D"""

        exp3 = """PeriodIndex: 2 entries, 2011-01-01 to 2011-01-02
Freq: D"""

        exp4 = """PeriodIndex: 3 entries, 2011-01-01 to 2011-01-03
Freq: D"""

        exp5 = """PeriodIndex: 3 entries, 2011 to 2013
Freq: A-DEC"""

        exp6 = """PeriodIndex: 3 entries, 2011-01-01 09:00 to NaT
Freq: H"""

        exp7 = """PeriodIndex: 1 entries, 2013Q1 to 2013Q1
Freq: Q-DEC"""

        exp8 = """PeriodIndex: 2 entries, 2013Q1 to 2013Q2
Freq: Q-DEC"""

        exp9 = """PeriodIndex: 3 entries, 2013Q1 to 2013Q3
Freq: Q-DEC"""

        for idx, expected in zip([idx1, idx2, idx3, idx4, idx5,
                                  idx6, idx7, idx8, idx9],
                                 [exp1, exp2, exp3, exp4, exp5,
                                  exp6, exp7, exp8, exp9]):
            result = idx.summary()
            assert result == expected

    def test_resolution(self):
        for freq, expected in zip(['A', 'Q', 'M', 'D', 'H',
                                   'T', 'S', 'L', 'U'],
                                  ['day', 'day', 'day', 'day',
                                   'hour', 'minute', 'second',
                                   'millisecond', 'microsecond']):

            idx = pd.period_range(start='2013-04-01', periods=30, freq=freq)
            assert idx.resolution == expected

    def test_add_iadd(self):
        rng = pd.period_range('1/1/2000', freq='D', periods=5)
        other = pd.period_range('1/6/2000', freq='D', periods=5)

        # previously performed setop union, now raises TypeError (GH14164)
        with pytest.raises(TypeError):
            rng + other

        with pytest.raises(TypeError):
            rng += other

        # offset
        # DateOffset
        rng = pd.period_range('2014', '2024', freq='A')
        result = rng + pd.offsets.YearEnd(5)
        expected = pd.period_range('2019', '2029', freq='A')
        tm.assert_index_equal(result, expected)
        rng += pd.offsets.YearEnd(5)
        tm.assert_index_equal(rng, expected)

        for o in [pd.offsets.YearBegin(2), pd.offsets.MonthBegin(1),
                  pd.offsets.Minute(), np.timedelta64(365, 'D'),
                  timedelta(365), Timedelta(days=365)]:
            msg = ('Input has different freq(=.+)? '
                   'from PeriodIndex\\(freq=A-DEC\\)')
            with tm.assert_raises_regex(
                    period.IncompatibleFrequency, msg):
                rng + o

        rng = pd.period_range('2014-01', '2016-12', freq='M')
        result = rng + pd.offsets.MonthEnd(5)
        expected = pd.period_range('2014-06', '2017-05', freq='M')
        tm.assert_index_equal(result, expected)
        rng += pd.offsets.MonthEnd(5)
        tm.assert_index_equal(rng, expected)

        for o in [pd.offsets.YearBegin(2), pd.offsets.MonthBegin(1),
                  pd.offsets.Minute(), np.timedelta64(365, 'D'),
                  timedelta(365), Timedelta(days=365)]:
            rng = pd.period_range('2014-01', '2016-12', freq='M')
            msg = 'Input has different freq(=.+)? from PeriodIndex\\(freq=M\\)'
            with tm.assert_raises_regex(
                    period.IncompatibleFrequency, msg):
                rng + o

        # Tick
        offsets = [pd.offsets.Day(3), timedelta(days=3),
                   np.timedelta64(3, 'D'), pd.offsets.Hour(72),
                   timedelta(minutes=60 * 24 * 3), np.timedelta64(72, 'h'),
                   Timedelta('72:00:00')]
        for delta in offsets:
            rng = pd.period_range('2014-05-01', '2014-05-15', freq='D')
            result = rng + delta
            expected = pd.period_range('2014-05-04', '2014-05-18', freq='D')
            tm.assert_index_equal(result, expected)
            rng += delta
            tm.assert_index_equal(rng, expected)

        for o in [pd.offsets.YearBegin(2), pd.offsets.MonthBegin(1),
                  pd.offsets.Minute(), np.timedelta64(4, 'h'),
                  timedelta(hours=23), Timedelta('23:00:00')]:
            rng = pd.period_range('2014-05-01', '2014-05-15', freq='D')
            msg = 'Input has different freq(=.+)? from PeriodIndex\\(freq=D\\)'
            with tm.assert_raises_regex(
                    period.IncompatibleFrequency, msg):
                rng + o

        offsets = [pd.offsets.Hour(2), timedelta(hours=2),
                   np.timedelta64(2, 'h'), pd.offsets.Minute(120),
                   timedelta(minutes=120), np.timedelta64(120, 'm'),
                   Timedelta(minutes=120)]
        for delta in offsets:
            rng = pd.period_range('2014-01-01 10:00', '2014-01-05 10:00',
                                  freq='H')
            result = rng + delta
            expected = pd.period_range('2014-01-01 12:00', '2014-01-05 12:00',
                                       freq='H')
            tm.assert_index_equal(result, expected)
            rng += delta
            tm.assert_index_equal(rng, expected)

        for delta in [pd.offsets.YearBegin(2), timedelta(minutes=30),
                      np.timedelta64(30, 's'), Timedelta(seconds=30)]:
            rng = pd.period_range('2014-01-01 10:00', '2014-01-05 10:00',
                                  freq='H')
            msg = 'Input has different freq(=.+)? from PeriodIndex\\(freq=H\\)'
            with tm.assert_raises_regex(
                    period.IncompatibleFrequency, msg):
                rng + delta
            with tm.assert_raises_regex(
                    period.IncompatibleFrequency, msg):
                rng += delta

        # int
        rng = pd.period_range('2000-01-01 09:00', freq='H', periods=10)
        result = rng + 1
        expected = pd.period_range('2000-01-01 10:00', freq='H', periods=10)
        tm.assert_index_equal(result, expected)
        rng += 1
        tm.assert_index_equal(rng, expected)

    def test_sub(self):
        rng = period_range('2007-01', periods=50)

        result = rng - 5
        exp = rng + (-5)
        tm.assert_index_equal(result, exp)

    def test_sub_isub(self):

        # previously performed setop, now raises TypeError (GH14164)
        # TODO needs to wait on #13077 for decision on result type
        rng = pd.period_range('1/1/2000', freq='D', periods=5)
        other = pd.period_range('1/6/2000', freq='D', periods=5)

        with pytest.raises(TypeError):
            rng - other

        with pytest.raises(TypeError):
            rng -= other

        # offset
        # DateOffset
        rng = pd.period_range('2014', '2024', freq='A')
        result = rng - pd.offsets.YearEnd(5)
        expected = pd.period_range('2009', '2019', freq='A')
        tm.assert_index_equal(result, expected)
        rng -= pd.offsets.YearEnd(5)
        tm.assert_index_equal(rng, expected)

        for o in [pd.offsets.YearBegin(2), pd.offsets.MonthBegin(1),
                  pd.offsets.Minute(), np.timedelta64(365, 'D'),
                  timedelta(365)]:
            rng = pd.period_range('2014', '2024', freq='A')
            msg = ('Input has different freq(=.+)? '
                   'from PeriodIndex\\(freq=A-DEC\\)')
            with tm.assert_raises_regex(
                    period.IncompatibleFrequency, msg):
                rng - o

        rng = pd.period_range('2014-01', '2016-12', freq='M')
        result = rng - pd.offsets.MonthEnd(5)
        expected = pd.period_range('2013-08', '2016-07', freq='M')
        tm.assert_index_equal(result, expected)
        rng -= pd.offsets.MonthEnd(5)
        tm.assert_index_equal(rng, expected)

        for o in [pd.offsets.YearBegin(2), pd.offsets.MonthBegin(1),
                  pd.offsets.Minute(), np.timedelta64(365, 'D'),
                  timedelta(365)]:
            rng = pd.period_range('2014-01', '2016-12', freq='M')
            msg = 'Input has different freq(=.+)? from PeriodIndex\\(freq=M\\)'
            with tm.assert_raises_regex(
                    period.IncompatibleFrequency, msg):
                rng - o

        # Tick
        offsets = [pd.offsets.Day(3), timedelta(days=3),
                   np.timedelta64(3, 'D'), pd.offsets.Hour(72),
                   timedelta(minutes=60 * 24 * 3), np.timedelta64(72, 'h')]
        for delta in offsets:
            rng = pd.period_range('2014-05-01', '2014-05-15', freq='D')
            result = rng - delta
            expected = pd.period_range('2014-04-28', '2014-05-12', freq='D')
            tm.assert_index_equal(result, expected)
            rng -= delta
            tm.assert_index_equal(rng, expected)

        for o in [pd.offsets.YearBegin(2), pd.offsets.MonthBegin(1),
                  pd.offsets.Minute(), np.timedelta64(4, 'h'),
                  timedelta(hours=23)]:
            rng = pd.period_range('2014-05-01', '2014-05-15', freq='D')
            msg = 'Input has different freq(=.+)? from PeriodIndex\\(freq=D\\)'
            with tm.assert_raises_regex(
                    period.IncompatibleFrequency, msg):
                rng - o

        offsets = [pd.offsets.Hour(2), timedelta(hours=2),
                   np.timedelta64(2, 'h'), pd.offsets.Minute(120),
                   timedelta(minutes=120), np.timedelta64(120, 'm')]
        for delta in offsets:
            rng = pd.period_range('2014-01-01 10:00', '2014-01-05 10:00',
                                  freq='H')
            result = rng - delta
            expected = pd.period_range('2014-01-01 08:00', '2014-01-05 08:00',
                                       freq='H')
            tm.assert_index_equal(result, expected)
            rng -= delta
            tm.assert_index_equal(rng, expected)

        for delta in [pd.offsets.YearBegin(2), timedelta(minutes=30),
                      np.timedelta64(30, 's')]:
            rng = pd.period_range('2014-01-01 10:00', '2014-01-05 10:00',
                                  freq='H')
            msg = 'Input has different freq(=.+)? from PeriodIndex\\(freq=H\\)'
            with tm.assert_raises_regex(
                    period.IncompatibleFrequency, msg):
                rng + delta
            with tm.assert_raises_regex(
                    period.IncompatibleFrequency, msg):
                rng += delta

        # int
        rng = pd.period_range('2000-01-01 09:00', freq='H', periods=10)
        result = rng - 1
        expected = pd.period_range('2000-01-01 08:00', freq='H', periods=10)
        tm.assert_index_equal(result, expected)
        rng -= 1
        tm.assert_index_equal(rng, expected)

    def test_comp_nat(self):
        left = pd.PeriodIndex([pd.Period('2011-01-01'), pd.NaT,
                               pd.Period('2011-01-03')])
        right = pd.PeriodIndex([pd.NaT, pd.NaT, pd.Period('2011-01-03')])

        for l, r in [(left, right), (left.asobject, right.asobject)]:
            result = l == r
            expected = np.array([False, False, True])
            tm.assert_numpy_array_equal(result, expected)

            result = l != r
            expected = np.array([True, True, False])
            tm.assert_numpy_array_equal(result, expected)

            expected = np.array([False, False, False])
            tm.assert_numpy_array_equal(l == pd.NaT, expected)
            tm.assert_numpy_array_equal(pd.NaT == r, expected)

            expected = np.array([True, True, True])
            tm.assert_numpy_array_equal(l != pd.NaT, expected)
            tm.assert_numpy_array_equal(pd.NaT != l, expected)

            expected = np.array([False, False, False])
            tm.assert_numpy_array_equal(l < pd.NaT, expected)
            tm.assert_numpy_array_equal(pd.NaT > l, expected)

    def test_value_counts_unique(self):
        # GH 7735
        idx = pd.period_range('2011-01-01 09:00', freq='H', periods=10)
        # create repeated values, 'n'th element is repeated by n+1 times
        idx = PeriodIndex(np.repeat(idx.values, range(1, len(idx) + 1)),
                          freq='H')

        exp_idx = PeriodIndex(['2011-01-01 18:00', '2011-01-01 17:00',
                               '2011-01-01 16:00', '2011-01-01 15:00',
                               '2011-01-01 14:00', '2011-01-01 13:00',
                               '2011-01-01 12:00', '2011-01-01 11:00',
                               '2011-01-01 10:00',
                               '2011-01-01 09:00'], freq='H')
        expected = Series(range(10, 0, -1), index=exp_idx, dtype='int64')

        for obj in [idx, Series(idx)]:
            tm.assert_series_equal(obj.value_counts(), expected)

        expected = pd.period_range('2011-01-01 09:00', freq='H',
                                   periods=10)
        tm.assert_index_equal(idx.unique(), expected)

        idx = PeriodIndex(['2013-01-01 09:00', '2013-01-01 09:00',
                           '2013-01-01 09:00', '2013-01-01 08:00',
                           '2013-01-01 08:00', pd.NaT], freq='H')

        exp_idx = PeriodIndex(['2013-01-01 09:00', '2013-01-01 08:00'],
                              freq='H')
        expected = Series([3, 2], index=exp_idx)

        for obj in [idx, Series(idx)]:
            tm.assert_series_equal(obj.value_counts(), expected)

        exp_idx = PeriodIndex(['2013-01-01 09:00', '2013-01-01 08:00',
                               pd.NaT], freq='H')
        expected = Series([3, 2, 1], index=exp_idx)

        for obj in [idx, Series(idx)]:
            tm.assert_series_equal(obj.value_counts(dropna=False), expected)

        tm.assert_index_equal(idx.unique(), exp_idx)

    def test_drop_duplicates_metadata(self):
        # GH 10115
        idx = pd.period_range('2011-01-01', '2011-01-31', freq='D', name='idx')
        result = idx.drop_duplicates()
        tm.assert_index_equal(idx, result)
        assert idx.freq == result.freq

        idx_dup = idx.append(idx)  # freq will not be reset
        result = idx_dup.drop_duplicates()
        tm.assert_index_equal(idx, result)
        assert idx.freq == result.freq

    def test_drop_duplicates(self):
        # to check Index/Series compat
        base = pd.period_range('2011-01-01', '2011-01-31', freq='D',
                               name='idx')
        idx = base.append(base[:5])

        res = idx.drop_duplicates()
        tm.assert_index_equal(res, base)
        res = Series(idx).drop_duplicates()
        tm.assert_series_equal(res, Series(base))

        res = idx.drop_duplicates(keep='last')
        exp = base[5:].append(base[:5])
        tm.assert_index_equal(res, exp)
        res = Series(idx).drop_duplicates(keep='last')
        tm.assert_series_equal(res, Series(exp, index=np.arange(5, 36)))

        res = idx.drop_duplicates(keep=False)
        tm.assert_index_equal(res, base[5:])
        res = Series(idx).drop_duplicates(keep=False)
        tm.assert_series_equal(res, Series(base[5:], index=np.arange(5, 31)))

    def test_order_compat(self):
        def _check_freq(index, expected_index):
            if isinstance(index, PeriodIndex):
                assert index.freq == expected_index.freq

        pidx = PeriodIndex(['2011', '2012', '2013'], name='pidx', freq='A')
        # for compatibility check
        iidx = Index([2011, 2012, 2013], name='idx')
        for idx in [pidx, iidx]:
            ordered = idx.sort_values()
            tm.assert_index_equal(ordered, idx)
            _check_freq(ordered, idx)

            ordered = idx.sort_values(ascending=False)
            tm.assert_index_equal(ordered, idx[::-1])
            _check_freq(ordered, idx[::-1])

            ordered, indexer = idx.sort_values(return_indexer=True)
            tm.assert_index_equal(ordered, idx)
            tm.assert_numpy_array_equal(indexer, np.array([0, 1, 2]),
                                        check_dtype=False)
            _check_freq(ordered, idx)

            ordered, indexer = idx.sort_values(return_indexer=True,
                                               ascending=False)
            tm.assert_index_equal(ordered, idx[::-1])
            tm.assert_numpy_array_equal(indexer, np.array([2, 1, 0]),
                                        check_dtype=False)
            _check_freq(ordered, idx[::-1])

        pidx = PeriodIndex(['2011', '2013', '2015', '2012',
                            '2011'], name='pidx', freq='A')
        pexpected = PeriodIndex(
            ['2011', '2011', '2012', '2013', '2015'], name='pidx', freq='A')
        # for compatibility check
        iidx = Index([2011, 2013, 2015, 2012, 2011], name='idx')
        iexpected = Index([2011, 2011, 2012, 2013, 2015], name='idx')
        for idx, expected in [(pidx, pexpected), (iidx, iexpected)]:
            ordered = idx.sort_values()
            tm.assert_index_equal(ordered, expected)
            _check_freq(ordered, idx)

            ordered = idx.sort_values(ascending=False)
            tm.assert_index_equal(ordered, expected[::-1])
            _check_freq(ordered, idx)

            ordered, indexer = idx.sort_values(return_indexer=True)
            tm.assert_index_equal(ordered, expected)

            exp = np.array([0, 4, 3, 1, 2])
            tm.assert_numpy_array_equal(indexer, exp, check_dtype=False)
            _check_freq(ordered, idx)

            ordered, indexer = idx.sort_values(return_indexer=True,
                                               ascending=False)
            tm.assert_index_equal(ordered, expected[::-1])

            exp = np.array([2, 1, 3, 4, 0])
            tm.assert_numpy_array_equal(indexer, exp, check_dtype=False)
            _check_freq(ordered, idx)

        pidx = PeriodIndex(['2011', '2013', 'NaT', '2011'], name='pidx',
                           freq='D')

        result = pidx.sort_values()
        expected = PeriodIndex(['NaT', '2011', '2011', '2013'],
                               name='pidx', freq='D')
        tm.assert_index_equal(result, expected)
        assert result.freq == 'D'

        result = pidx.sort_values(ascending=False)
        expected = PeriodIndex(
            ['2013', '2011', '2011', 'NaT'], name='pidx', freq='D')
        tm.assert_index_equal(result, expected)
        assert result.freq == 'D'

    def test_order(self):
        for freq in ['D', '2D', '4D']:
            idx = PeriodIndex(['2011-01-01', '2011-01-02', '2011-01-03'],
                              freq=freq, name='idx')

            ordered = idx.sort_values()
            tm.assert_index_equal(ordered, idx)
            assert ordered.freq == idx.freq

            ordered = idx.sort_values(ascending=False)
            expected = idx[::-1]
            tm.assert_index_equal(ordered, expected)
            assert ordered.freq == expected.freq
            assert ordered.freq == freq

            ordered, indexer = idx.sort_values(return_indexer=True)
            tm.assert_index_equal(ordered, idx)
            tm.assert_numpy_array_equal(indexer, np.array([0, 1, 2]),
                                        check_dtype=False)
            assert ordered.freq == idx.freq
            assert ordered.freq == freq

            ordered, indexer = idx.sort_values(return_indexer=True,
                                               ascending=False)
            expected = idx[::-1]
            tm.assert_index_equal(ordered, expected)
            tm.assert_numpy_array_equal(indexer, np.array([2, 1, 0]),
                                        check_dtype=False)
            assert ordered.freq == expected.freq
            assert ordered.freq == freq

        idx1 = PeriodIndex(['2011-01-01', '2011-01-03', '2011-01-05',
                            '2011-01-02', '2011-01-01'], freq='D', name='idx1')
        exp1 = PeriodIndex(['2011-01-01', '2011-01-01', '2011-01-02',
                            '2011-01-03', '2011-01-05'], freq='D', name='idx1')

        idx2 = PeriodIndex(['2011-01-01', '2011-01-03', '2011-01-05',
                            '2011-01-02', '2011-01-01'],
                           freq='D', name='idx2')
        exp2 = PeriodIndex(['2011-01-01', '2011-01-01', '2011-01-02',
                            '2011-01-03', '2011-01-05'],
                           freq='D', name='idx2')

        idx3 = PeriodIndex([pd.NaT, '2011-01-03', '2011-01-05',
                            '2011-01-02', pd.NaT], freq='D', name='idx3')
        exp3 = PeriodIndex([pd.NaT, pd.NaT, '2011-01-02', '2011-01-03',
                            '2011-01-05'], freq='D', name='idx3')

        for idx, expected in [(idx1, exp1), (idx2, exp2), (idx3, exp3)]:
            ordered = idx.sort_values()
            tm.assert_index_equal(ordered, expected)
            assert ordered.freq == 'D'

            ordered = idx.sort_values(ascending=False)
            tm.assert_index_equal(ordered, expected[::-1])
            assert ordered.freq == 'D'

            ordered, indexer = idx.sort_values(return_indexer=True)
            tm.assert_index_equal(ordered, expected)

            exp = np.array([0, 4, 3, 1, 2])
            tm.assert_numpy_array_equal(indexer, exp, check_dtype=False)
            assert ordered.freq == 'D'

            ordered, indexer = idx.sort_values(return_indexer=True,
                                               ascending=False)
            tm.assert_index_equal(ordered, expected[::-1])

            exp = np.array([2, 1, 3, 4, 0])
            tm.assert_numpy_array_equal(indexer, exp, check_dtype=False)
            assert ordered.freq == 'D'

    def test_nat_new(self):

        idx = pd.period_range('2011-01', freq='M', periods=5, name='x')
        result = idx._nat_new()
        exp = pd.PeriodIndex([pd.NaT] * 5, freq='M', name='x')
        tm.assert_index_equal(result, exp)

        result = idx._nat_new(box=False)
        exp = np.array([tslib.iNaT] * 5, dtype=np.int64)
        tm.assert_numpy_array_equal(result, exp)

    def test_shift(self):
        # GH 9903
        idx = pd.PeriodIndex([], name='xxx', freq='H')

        with pytest.raises(TypeError):
            # period shift doesn't accept freq
            idx.shift(1, freq='H')

        tm.assert_index_equal(idx.shift(0), idx)
        tm.assert_index_equal(idx.shift(3), idx)

        idx = pd.PeriodIndex(['2011-01-01 10:00', '2011-01-01 11:00'
                              '2011-01-01 12:00'], name='xxx', freq='H')
        tm.assert_index_equal(idx.shift(0), idx)
        exp = pd.PeriodIndex(['2011-01-01 13:00', '2011-01-01 14:00'
                              '2011-01-01 15:00'], name='xxx', freq='H')
        tm.assert_index_equal(idx.shift(3), exp)
        exp = pd.PeriodIndex(['2011-01-01 07:00', '2011-01-01 08:00'
                              '2011-01-01 09:00'], name='xxx', freq='H')
        tm.assert_index_equal(idx.shift(-3), exp)

    def test_repeat(self):
        index = pd.period_range('2001-01-01', periods=2, freq='D')
        exp = pd.PeriodIndex(['2001-01-01', '2001-01-01',
                              '2001-01-02', '2001-01-02'], freq='D')
        for res in [index.repeat(2), np.repeat(index, 2)]:
            tm.assert_index_equal(res, exp)

        index = pd.period_range('2001-01-01', periods=2, freq='2D')
        exp = pd.PeriodIndex(['2001-01-01', '2001-01-01',
                              '2001-01-03', '2001-01-03'], freq='2D')
        for res in [index.repeat(2), np.repeat(index, 2)]:
            tm.assert_index_equal(res, exp)

        index = pd.PeriodIndex(['2001-01', 'NaT', '2003-01'], freq='M')
        exp = pd.PeriodIndex(['2001-01', '2001-01', '2001-01',
                              'NaT', 'NaT', 'NaT',
                              '2003-01', '2003-01', '2003-01'], freq='M')
        for res in [index.repeat(3), np.repeat(index, 3)]:
            tm.assert_index_equal(res, exp)

    def test_nat(self):
        assert pd.PeriodIndex._na_value is pd.NaT
        assert pd.PeriodIndex([], freq='M')._na_value is pd.NaT

        idx = pd.PeriodIndex(['2011-01-01', '2011-01-02'], freq='D')
        assert idx._can_hold_na

        tm.assert_numpy_array_equal(idx._isnan, np.array([False, False]))
        assert not idx.hasnans
        tm.assert_numpy_array_equal(idx._nan_idxs,
                                    np.array([], dtype=np.intp))

        idx = pd.PeriodIndex(['2011-01-01', 'NaT'], freq='D')
        assert idx._can_hold_na

        tm.assert_numpy_array_equal(idx._isnan, np.array([False, True]))
        assert idx.hasnans
        tm.assert_numpy_array_equal(idx._nan_idxs,
                                    np.array([1], dtype=np.intp))

    def test_equals(self):
        # GH 13107
        for freq in ['D', 'M']:
            idx = pd.PeriodIndex(['2011-01-01', '2011-01-02', 'NaT'],
                                 freq=freq)
            assert idx.equals(idx)
            assert idx.equals(idx.copy())
            assert idx.equals(idx.asobject)
            assert idx.asobject.equals(idx)
            assert idx.asobject.equals(idx.asobject)
            assert not idx.equals(list(idx))
            assert not idx.equals(pd.Series(idx))

            idx2 = pd.PeriodIndex(['2011-01-01', '2011-01-02', 'NaT'],
                                  freq='H')
            assert not idx.equals(idx2)
            assert not idx.equals(idx2.copy())
            assert not idx.equals(idx2.asobject)
            assert not idx.asobject.equals(idx2)
            assert not idx.equals(list(idx2))
            assert not idx.equals(pd.Series(idx2))

            # same internal, different tz
            idx3 = pd.PeriodIndex._simple_new(idx.asi8, freq='H')
            tm.assert_numpy_array_equal(idx.asi8, idx3.asi8)
            assert not idx.equals(idx3)
            assert not idx.equals(idx3.copy())
            assert not idx.equals(idx3.asobject)
            assert not idx.asobject.equals(idx3)
            assert not idx.equals(list(idx3))
            assert not idx.equals(pd.Series(idx3))


class TestPeriodIndexSeriesMethods(object):
    """ Test PeriodIndex and Period Series Ops consistency """

    def _check(self, values, func, expected):
        idx = pd.PeriodIndex(values)
        result = func(idx)
        if isinstance(expected, pd.Index):
            tm.assert_index_equal(result, expected)
        else:
            # comp op results in bool
            tm.assert_numpy_array_equal(result, expected)

        s = pd.Series(values)
        result = func(s)

        exp = pd.Series(expected, name=values.name)
        tm.assert_series_equal(result, exp)

    def test_pi_ops(self):
        idx = PeriodIndex(['2011-01', '2011-02', '2011-03',
                           '2011-04'], freq='M', name='idx')

        expected = PeriodIndex(['2011-03', '2011-04',
                                '2011-05', '2011-06'], freq='M', name='idx')
        self._check(idx, lambda x: x + 2, expected)
        self._check(idx, lambda x: 2 + x, expected)

        self._check(idx + 2, lambda x: x - 2, idx)
        result = idx - Period('2011-01', freq='M')
        exp = pd.Index([0, 1, 2, 3], name='idx')
        tm.assert_index_equal(result, exp)

        result = Period('2011-01', freq='M') - idx
        exp = pd.Index([0, -1, -2, -3], name='idx')
        tm.assert_index_equal(result, exp)

    def test_pi_ops_errors(self):
        idx = PeriodIndex(['2011-01', '2011-02', '2011-03',
                           '2011-04'], freq='M', name='idx')
        s = pd.Series(idx)

        msg = r"unsupported operand type\(s\)"

        for obj in [idx, s]:
            for ng in ["str", 1.5]:
                with tm.assert_raises_regex(TypeError, msg):
                    obj + ng

                with pytest.raises(TypeError):
                    # error message differs between PY2 and 3
                    ng + obj

                with tm.assert_raises_regex(TypeError, msg):
                    obj - ng

                with pytest.raises(TypeError):
                    np.add(obj, ng)

                if _np_version_under1p10:
                    assert np.add(ng, obj) is NotImplemented
                else:
                    with pytest.raises(TypeError):
                        np.add(ng, obj)

                with pytest.raises(TypeError):
                    np.subtract(obj, ng)

                if _np_version_under1p10:
                    assert np.subtract(ng, obj) is NotImplemented
                else:
                    with pytest.raises(TypeError):
                        np.subtract(ng, obj)

    def test_pi_ops_nat(self):
        idx = PeriodIndex(['2011-01', '2011-02', 'NaT',
                           '2011-04'], freq='M', name='idx')
        expected = PeriodIndex(['2011-03', '2011-04',
                                'NaT', '2011-06'], freq='M', name='idx')
        self._check(idx, lambda x: x + 2, expected)
        self._check(idx, lambda x: 2 + x, expected)
        self._check(idx, lambda x: np.add(x, 2), expected)

        self._check(idx + 2, lambda x: x - 2, idx)
        self._check(idx + 2, lambda x: np.subtract(x, 2), idx)

        # freq with mult
        idx = PeriodIndex(['2011-01', '2011-02', 'NaT',
                           '2011-04'], freq='2M', name='idx')
        expected = PeriodIndex(['2011-07', '2011-08',
                                'NaT', '2011-10'], freq='2M', name='idx')
        self._check(idx, lambda x: x + 3, expected)
        self._check(idx, lambda x: 3 + x, expected)
        self._check(idx, lambda x: np.add(x, 3), expected)

        self._check(idx + 3, lambda x: x - 3, idx)
        self._check(idx + 3, lambda x: np.subtract(x, 3), idx)

    def test_pi_ops_array_int(self):
        idx = PeriodIndex(['2011-01', '2011-02', 'NaT',
                           '2011-04'], freq='M', name='idx')
        f = lambda x: x + np.array([1, 2, 3, 4])
        exp = PeriodIndex(['2011-02', '2011-04', 'NaT',
                           '2011-08'], freq='M', name='idx')
        self._check(idx, f, exp)

        f = lambda x: np.add(x, np.array([4, -1, 1, 2]))
        exp = PeriodIndex(['2011-05', '2011-01', 'NaT',
                           '2011-06'], freq='M', name='idx')
        self._check(idx, f, exp)

        f = lambda x: x - np.array([1, 2, 3, 4])
        exp = PeriodIndex(['2010-12', '2010-12', 'NaT',
                           '2010-12'], freq='M', name='idx')
        self._check(idx, f, exp)

        f = lambda x: np.subtract(x, np.array([3, 2, 3, -2]))
        exp = PeriodIndex(['2010-10', '2010-12', 'NaT',
                           '2011-06'], freq='M', name='idx')
        self._check(idx, f, exp)

    def test_pi_ops_offset(self):
        idx = PeriodIndex(['2011-01-01', '2011-02-01', '2011-03-01',
                           '2011-04-01'], freq='D', name='idx')
        f = lambda x: x + offsets.Day()
        exp = PeriodIndex(['2011-01-02', '2011-02-02', '2011-03-02',
                           '2011-04-02'], freq='D', name='idx')
        self._check(idx, f, exp)

        f = lambda x: x + offsets.Day(2)
        exp = PeriodIndex(['2011-01-03', '2011-02-03', '2011-03-03',
                           '2011-04-03'], freq='D', name='idx')
        self._check(idx, f, exp)

        f = lambda x: x - offsets.Day(2)
        exp = PeriodIndex(['2010-12-30', '2011-01-30', '2011-02-27',
                           '2011-03-30'], freq='D', name='idx')
        self._check(idx, f, exp)

    def test_pi_offset_errors(self):
        idx = PeriodIndex(['2011-01-01', '2011-02-01', '2011-03-01',
                           '2011-04-01'], freq='D', name='idx')
        s = pd.Series(idx)

        # Series op is applied per Period instance, thus error is raised
        # from Period
        msg_idx = r"Input has different freq from PeriodIndex\(freq=D\)"
        msg_s = r"Input cannot be converted to Period\(freq=D\)"
        for obj, msg in [(idx, msg_idx), (s, msg_s)]:
            with tm.assert_raises_regex(
                    period.IncompatibleFrequency, msg):
                obj + offsets.Hour(2)

            with tm.assert_raises_regex(
                    period.IncompatibleFrequency, msg):
                offsets.Hour(2) + obj

            with tm.assert_raises_regex(
                    period.IncompatibleFrequency, msg):
                obj - offsets.Hour(2)

    def test_pi_sub_period(self):
        # GH 13071
        idx = PeriodIndex(['2011-01', '2011-02', '2011-03',
                           '2011-04'], freq='M', name='idx')

        result = idx - pd.Period('2012-01', freq='M')
        exp = pd.Index([-12, -11, -10, -9], name='idx')
        tm.assert_index_equal(result, exp)

        result = np.subtract(idx, pd.Period('2012-01', freq='M'))
        tm.assert_index_equal(result, exp)

        result = pd.Period('2012-01', freq='M') - idx
        exp = pd.Index([12, 11, 10, 9], name='idx')
        tm.assert_index_equal(result, exp)

        result = np.subtract(pd.Period('2012-01', freq='M'), idx)
        if _np_version_under1p10:
            assert result is NotImplemented
        else:
            tm.assert_index_equal(result, exp)

        exp = pd.TimedeltaIndex([np.nan, np.nan, np.nan, np.nan], name='idx')
        tm.assert_index_equal(idx - pd.Period('NaT', freq='M'), exp)
        tm.assert_index_equal(pd.Period('NaT', freq='M') - idx, exp)

    def test_pi_sub_pdnat(self):
        # GH 13071
        idx = PeriodIndex(['2011-01', '2011-02', 'NaT',
                           '2011-04'], freq='M', name='idx')
        exp = pd.TimedeltaIndex([pd.NaT] * 4, name='idx')
        tm.assert_index_equal(pd.NaT - idx, exp)
        tm.assert_index_equal(idx - pd.NaT, exp)

    def test_pi_sub_period_nat(self):
        # GH 13071
        idx = PeriodIndex(['2011-01', 'NaT', '2011-03',
                           '2011-04'], freq='M', name='idx')

        result = idx - pd.Period('2012-01', freq='M')
        exp = pd.Index([-12, np.nan, -10, -9], name='idx')
        tm.assert_index_equal(result, exp)

        result = pd.Period('2012-01', freq='M') - idx
        exp = pd.Index([12, np.nan, 10, 9], name='idx')
        tm.assert_index_equal(result, exp)

        exp = pd.TimedeltaIndex([np.nan, np.nan, np.nan, np.nan], name='idx')
        tm.assert_index_equal(idx - pd.Period('NaT', freq='M'), exp)
        tm.assert_index_equal(pd.Period('NaT', freq='M') - idx, exp)

    def test_pi_comp_period(self):
        idx = PeriodIndex(['2011-01', '2011-02', '2011-03',
                           '2011-04'], freq='M', name='idx')

        f = lambda x: x == pd.Period('2011-03', freq='M')
        exp = np.array([False, False, True, False], dtype=np.bool)
        self._check(idx, f, exp)
        f = lambda x: pd.Period('2011-03', freq='M') == x
        self._check(idx, f, exp)

        f = lambda x: x != pd.Period('2011-03', freq='M')
        exp = np.array([True, True, False, True], dtype=np.bool)
        self._check(idx, f, exp)
        f = lambda x: pd.Period('2011-03', freq='M') != x
        self._check(idx, f, exp)

        f = lambda x: pd.Period('2011-03', freq='M') >= x
        exp = np.array([True, True, True, False], dtype=np.bool)
        self._check(idx, f, exp)

        f = lambda x: x > pd.Period('2011-03', freq='M')
        exp = np.array([False, False, False, True], dtype=np.bool)
        self._check(idx, f, exp)

        f = lambda x: pd.Period('2011-03', freq='M') >= x
        exp = np.array([True, True, True, False], dtype=np.bool)
        self._check(idx, f, exp)

    def test_pi_comp_period_nat(self):
        idx = PeriodIndex(['2011-01', 'NaT', '2011-03',
                           '2011-04'], freq='M', name='idx')

        f = lambda x: x == pd.Period('2011-03', freq='M')
        exp = np.array([False, False, True, False], dtype=np.bool)
        self._check(idx, f, exp)
        f = lambda x: pd.Period('2011-03', freq='M') == x
        self._check(idx, f, exp)

        f = lambda x: x == tslib.NaT
        exp = np.array([False, False, False, False], dtype=np.bool)
        self._check(idx, f, exp)
        f = lambda x: tslib.NaT == x
        self._check(idx, f, exp)

        f = lambda x: x != pd.Period('2011-03', freq='M')
        exp = np.array([True, True, False, True], dtype=np.bool)
        self._check(idx, f, exp)
        f = lambda x: pd.Period('2011-03', freq='M') != x
        self._check(idx, f, exp)

        f = lambda x: x != tslib.NaT
        exp = np.array([True, True, True, True], dtype=np.bool)
        self._check(idx, f, exp)
        f = lambda x: tslib.NaT != x
        self._check(idx, f, exp)

        f = lambda x: pd.Period('2011-03', freq='M') >= x
        exp = np.array([True, False, True, False], dtype=np.bool)
        self._check(idx, f, exp)

        f = lambda x: x < pd.Period('2011-03', freq='M')
        exp = np.array([True, False, False, False], dtype=np.bool)
        self._check(idx, f, exp)

        f = lambda x: x > tslib.NaT
        exp = np.array([False, False, False, False], dtype=np.bool)
        self._check(idx, f, exp)

        f = lambda x: tslib.NaT >= x
        exp = np.array([False, False, False, False], dtype=np.bool)
        self._check(idx, f, exp)


class TestSeriesPeriod(object):

    def setup_method(self, method):
        self.series = Series(period_range('2000-01-01', periods=10, freq='D'))

    def test_ops_series_timedelta(self):
        # GH 13043
        s = pd.Series([pd.Period('2015-01-01', freq='D'),
                       pd.Period('2015-01-02', freq='D')], name='xxx')
        assert s.dtype == object

        exp = pd.Series([pd.Period('2015-01-02', freq='D'),
                         pd.Period('2015-01-03', freq='D')], name='xxx')
        tm.assert_series_equal(s + pd.Timedelta('1 days'), exp)
        tm.assert_series_equal(pd.Timedelta('1 days') + s, exp)

        tm.assert_series_equal(s + pd.tseries.offsets.Day(), exp)
        tm.assert_series_equal(pd.tseries.offsets.Day() + s, exp)

    def test_ops_series_period(self):
        # GH 13043
        s = pd.Series([pd.Period('2015-01-01', freq='D'),
                       pd.Period('2015-01-02', freq='D')], name='xxx')
        assert s.dtype == object

        p = pd.Period('2015-01-10', freq='D')
        # dtype will be object because of original dtype
        exp = pd.Series([9, 8], name='xxx', dtype=object)
        tm.assert_series_equal(p - s, exp)
        tm.assert_series_equal(s - p, -exp)

        s2 = pd.Series([pd.Period('2015-01-05', freq='D'),
                        pd.Period('2015-01-04', freq='D')], name='xxx')
        assert s2.dtype == object

        exp = pd.Series([4, 2], name='xxx', dtype=object)
        tm.assert_series_equal(s2 - s, exp)
        tm.assert_series_equal(s - s2, -exp)


class TestFramePeriod(object):

    def test_ops_frame_period(self):
        # GH 13043
        df = pd.DataFrame({'A': [pd.Period('2015-01', freq='M'),
                                 pd.Period('2015-02', freq='M')],
                           'B': [pd.Period('2014-01', freq='M'),
                                 pd.Period('2014-02', freq='M')]})
        assert df['A'].dtype == object
        assert df['B'].dtype == object

        p = pd.Period('2015-03', freq='M')
        # dtype will be object because of original dtype
        exp = pd.DataFrame({'A': np.array([2, 1], dtype=object),
                            'B': np.array([14, 13], dtype=object)})
        tm.assert_frame_equal(p - df, exp)
        tm.assert_frame_equal(df - p, -exp)

        df2 = pd.DataFrame({'A': [pd.Period('2015-05', freq='M'),
                                  pd.Period('2015-06', freq='M')],
                            'B': [pd.Period('2015-05', freq='M'),
                                  pd.Period('2015-06', freq='M')]})
        assert df2['A'].dtype == object
        assert df2['B'].dtype == object

        exp = pd.DataFrame({'A': np.array([4, 4], dtype=object),
                            'B': np.array([16, 16], dtype=object)})
        tm.assert_frame_equal(df2 - df, exp)
        tm.assert_frame_equal(df - df2, -exp)


class TestPeriodIndexComparisons(object):

    def test_pi_pi_comp(self):

        for freq in ['M', '2M', '3M']:
            base = PeriodIndex(['2011-01', '2011-02',
                                '2011-03', '2011-04'], freq=freq)
            p = Period('2011-02', freq=freq)

            exp = np.array([False, True, False, False])
            tm.assert_numpy_array_equal(base == p, exp)
            tm.assert_numpy_array_equal(p == base, exp)

            exp = np.array([True, False, True, True])
            tm.assert_numpy_array_equal(base != p, exp)
            tm.assert_numpy_array_equal(p != base, exp)

            exp = np.array([False, False, True, True])
            tm.assert_numpy_array_equal(base > p, exp)
            tm.assert_numpy_array_equal(p < base, exp)

            exp = np.array([True, False, False, False])
            tm.assert_numpy_array_equal(base < p, exp)
            tm.assert_numpy_array_equal(p > base, exp)

            exp = np.array([False, True, True, True])
            tm.assert_numpy_array_equal(base >= p, exp)
            tm.assert_numpy_array_equal(p <= base, exp)

            exp = np.array([True, True, False, False])
            tm.assert_numpy_array_equal(base <= p, exp)
            tm.assert_numpy_array_equal(p >= base, exp)

            idx = PeriodIndex(['2011-02', '2011-01', '2011-03',
                               '2011-05'], freq=freq)

            exp = np.array([False, False, True, False])
            tm.assert_numpy_array_equal(base == idx, exp)

            exp = np.array([True, True, False, True])
            tm.assert_numpy_array_equal(base != idx, exp)

            exp = np.array([False, True, False, False])
            tm.assert_numpy_array_equal(base > idx, exp)

            exp = np.array([True, False, False, True])
            tm.assert_numpy_array_equal(base < idx, exp)

            exp = np.array([False, True, True, False])
            tm.assert_numpy_array_equal(base >= idx, exp)

            exp = np.array([True, False, True, True])
            tm.assert_numpy_array_equal(base <= idx, exp)

            # different base freq
            msg = "Input has different freq=A-DEC from PeriodIndex"
            with tm.assert_raises_regex(
                    period.IncompatibleFrequency, msg):
                base <= Period('2011', freq='A')

            with tm.assert_raises_regex(
                    period.IncompatibleFrequency, msg):
                Period('2011', freq='A') >= base

            with tm.assert_raises_regex(
                    period.IncompatibleFrequency, msg):
                idx = PeriodIndex(['2011', '2012', '2013', '2014'], freq='A')
                base <= idx

            # Different frequency
            msg = "Input has different freq=4M from PeriodIndex"
            with tm.assert_raises_regex(
                    period.IncompatibleFrequency, msg):
                base <= Period('2011', freq='4M')

            with tm.assert_raises_regex(
                    period.IncompatibleFrequency, msg):
                Period('2011', freq='4M') >= base

            with tm.assert_raises_regex(
                    period.IncompatibleFrequency, msg):
                idx = PeriodIndex(['2011', '2012', '2013', '2014'], freq='4M')
                base <= idx

    def test_pi_nat_comp(self):
        for freq in ['M', '2M', '3M']:
            idx1 = PeriodIndex(
                ['2011-01', '2011-02', 'NaT', '2011-05'], freq=freq)

            result = idx1 > Period('2011-02', freq=freq)
            exp = np.array([False, False, False, True])
            tm.assert_numpy_array_equal(result, exp)
            result = Period('2011-02', freq=freq) < idx1
            tm.assert_numpy_array_equal(result, exp)

            result = idx1 == Period('NaT', freq=freq)
            exp = np.array([False, False, False, False])
            tm.assert_numpy_array_equal(result, exp)
            result = Period('NaT', freq=freq) == idx1
            tm.assert_numpy_array_equal(result, exp)

            result = idx1 != Period('NaT', freq=freq)
            exp = np.array([True, True, True, True])
            tm.assert_numpy_array_equal(result, exp)
            result = Period('NaT', freq=freq) != idx1
            tm.assert_numpy_array_equal(result, exp)

            idx2 = PeriodIndex(['2011-02', '2011-01', '2011-04',
                                'NaT'], freq=freq)
            result = idx1 < idx2
            exp = np.array([True, False, False, False])
            tm.assert_numpy_array_equal(result, exp)

            result = idx1 == idx2
            exp = np.array([False, False, False, False])
            tm.assert_numpy_array_equal(result, exp)

            result = idx1 != idx2
            exp = np.array([True, True, True, True])
            tm.assert_numpy_array_equal(result, exp)

            result = idx1 == idx1
            exp = np.array([True, True, False, True])
            tm.assert_numpy_array_equal(result, exp)

            result = idx1 != idx1
            exp = np.array([False, False, True, False])
            tm.assert_numpy_array_equal(result, exp)

            diff = PeriodIndex(['2011-02', '2011-01', '2011-04',
                                'NaT'], freq='4M')
            msg = "Input has different freq=4M from PeriodIndex"
            with tm.assert_raises_regex(
                    period.IncompatibleFrequency, msg):
                idx1 > diff

            with tm.assert_raises_regex(
                    period.IncompatibleFrequency, msg):
                idx1 == diff
