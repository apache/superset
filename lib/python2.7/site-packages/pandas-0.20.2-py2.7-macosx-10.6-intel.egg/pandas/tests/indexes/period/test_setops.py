import pytest

import numpy as np

import pandas as pd
import pandas.util.testing as tm
import pandas.core.indexes.period as period
from pandas import period_range, PeriodIndex, Index, date_range


def _permute(obj):
    return obj.take(np.random.permutation(len(obj)))


class TestPeriodIndex(object):

    def setup_method(self, method):
        pass

    def test_joins(self):
        index = period_range('1/1/2000', '1/20/2000', freq='D')

        for kind in ['inner', 'outer', 'left', 'right']:
            joined = index.join(index[:-5], how=kind)

            assert isinstance(joined, PeriodIndex)
            assert joined.freq == index.freq

    def test_join_self(self):
        index = period_range('1/1/2000', '1/20/2000', freq='D')

        for kind in ['inner', 'outer', 'left', 'right']:
            res = index.join(index, how=kind)
            assert index is res

    def test_join_does_not_recur(self):
        df = tm.makeCustomDataframe(
            3, 2, data_gen_f=lambda *args: np.random.randint(2),
            c_idx_type='p', r_idx_type='dt')
        s = df.iloc[:2, 0]

        res = s.index.join(df.columns, how='outer')
        expected = Index([s.index[0], s.index[1],
                          df.columns[0], df.columns[1]], object)
        tm.assert_index_equal(res, expected)

    def test_union(self):
        # union
        rng1 = pd.period_range('1/1/2000', freq='D', periods=5)
        other1 = pd.period_range('1/6/2000', freq='D', periods=5)
        expected1 = pd.period_range('1/1/2000', freq='D', periods=10)

        rng2 = pd.period_range('1/1/2000', freq='D', periods=5)
        other2 = pd.period_range('1/4/2000', freq='D', periods=5)
        expected2 = pd.period_range('1/1/2000', freq='D', periods=8)

        rng3 = pd.period_range('1/1/2000', freq='D', periods=5)
        other3 = pd.PeriodIndex([], freq='D')
        expected3 = pd.period_range('1/1/2000', freq='D', periods=5)

        rng4 = pd.period_range('2000-01-01 09:00', freq='H', periods=5)
        other4 = pd.period_range('2000-01-02 09:00', freq='H', periods=5)
        expected4 = pd.PeriodIndex(['2000-01-01 09:00', '2000-01-01 10:00',
                                    '2000-01-01 11:00', '2000-01-01 12:00',
                                    '2000-01-01 13:00', '2000-01-02 09:00',
                                    '2000-01-02 10:00', '2000-01-02 11:00',
                                    '2000-01-02 12:00', '2000-01-02 13:00'],
                                   freq='H')

        rng5 = pd.PeriodIndex(['2000-01-01 09:01', '2000-01-01 09:03',
                               '2000-01-01 09:05'], freq='T')
        other5 = pd.PeriodIndex(['2000-01-01 09:01', '2000-01-01 09:05'
                                                     '2000-01-01 09:08'],
                                freq='T')
        expected5 = pd.PeriodIndex(['2000-01-01 09:01', '2000-01-01 09:03',
                                    '2000-01-01 09:05', '2000-01-01 09:08'],
                                   freq='T')

        rng6 = pd.period_range('2000-01-01', freq='M', periods=7)
        other6 = pd.period_range('2000-04-01', freq='M', periods=7)
        expected6 = pd.period_range('2000-01-01', freq='M', periods=10)

        rng7 = pd.period_range('2003-01-01', freq='A', periods=5)
        other7 = pd.period_range('1998-01-01', freq='A', periods=8)
        expected7 = pd.period_range('1998-01-01', freq='A', periods=10)

        for rng, other, expected in [(rng1, other1, expected1),
                                     (rng2, other2, expected2),
                                     (rng3, other3, expected3), (rng4, other4,
                                                                 expected4),
                                     (rng5, other5, expected5), (rng6, other6,
                                                                 expected6),
                                     (rng7, other7, expected7)]:

            result_union = rng.union(other)
            tm.assert_index_equal(result_union, expected)

    def test_union_misc(self):
        index = period_range('1/1/2000', '1/20/2000', freq='D')

        result = index[:-5].union(index[10:])
        tm.assert_index_equal(result, index)

        # not in order
        result = _permute(index[:-5]).union(_permute(index[10:]))
        tm.assert_index_equal(result, index)

        # raise if different frequencies
        index = period_range('1/1/2000', '1/20/2000', freq='D')
        index2 = period_range('1/1/2000', '1/20/2000', freq='W-WED')
        with pytest.raises(period.IncompatibleFrequency):
            index.union(index2)

        msg = 'can only call with other PeriodIndex-ed objects'
        with tm.assert_raises_regex(ValueError, msg):
            index.join(index.to_timestamp())

        index3 = period_range('1/1/2000', '1/20/2000', freq='2D')
        with pytest.raises(period.IncompatibleFrequency):
            index.join(index3)

    def test_union_dataframe_index(self):
        rng1 = pd.period_range('1/1/1999', '1/1/2012', freq='M')
        s1 = pd.Series(np.random.randn(len(rng1)), rng1)

        rng2 = pd.period_range('1/1/1980', '12/1/2001', freq='M')
        s2 = pd.Series(np.random.randn(len(rng2)), rng2)
        df = pd.DataFrame({'s1': s1, 's2': s2})

        exp = pd.period_range('1/1/1980', '1/1/2012', freq='M')
        tm.assert_index_equal(df.index, exp)

    def test_intersection(self):
        index = period_range('1/1/2000', '1/20/2000', freq='D')

        result = index[:-5].intersection(index[10:])
        tm.assert_index_equal(result, index[10:-5])

        # not in order
        left = _permute(index[:-5])
        right = _permute(index[10:])
        result = left.intersection(right).sort_values()
        tm.assert_index_equal(result, index[10:-5])

        # raise if different frequencies
        index = period_range('1/1/2000', '1/20/2000', freq='D')
        index2 = period_range('1/1/2000', '1/20/2000', freq='W-WED')
        with pytest.raises(period.IncompatibleFrequency):
            index.intersection(index2)

        index3 = period_range('1/1/2000', '1/20/2000', freq='2D')
        with pytest.raises(period.IncompatibleFrequency):
            index.intersection(index3)

    def test_intersection_cases(self):
        base = period_range('6/1/2000', '6/30/2000', freq='D', name='idx')

        # if target has the same name, it is preserved
        rng2 = period_range('5/15/2000', '6/20/2000', freq='D', name='idx')
        expected2 = period_range('6/1/2000', '6/20/2000', freq='D',
                                 name='idx')

        # if target name is different, it will be reset
        rng3 = period_range('5/15/2000', '6/20/2000', freq='D', name='other')
        expected3 = period_range('6/1/2000', '6/20/2000', freq='D',
                                 name=None)

        rng4 = period_range('7/1/2000', '7/31/2000', freq='D', name='idx')
        expected4 = PeriodIndex([], name='idx', freq='D')

        for (rng, expected) in [(rng2, expected2), (rng3, expected3),
                                (rng4, expected4)]:
            result = base.intersection(rng)
            tm.assert_index_equal(result, expected)
            assert result.name == expected.name
            assert result.freq == expected.freq

        # non-monotonic
        base = PeriodIndex(['2011-01-05', '2011-01-04', '2011-01-02',
                            '2011-01-03'], freq='D', name='idx')

        rng2 = PeriodIndex(['2011-01-04', '2011-01-02',
                            '2011-02-02', '2011-02-03'],
                           freq='D', name='idx')
        expected2 = PeriodIndex(['2011-01-04', '2011-01-02'], freq='D',
                                name='idx')

        rng3 = PeriodIndex(['2011-01-04', '2011-01-02', '2011-02-02',
                            '2011-02-03'],
                           freq='D', name='other')
        expected3 = PeriodIndex(['2011-01-04', '2011-01-02'], freq='D',
                                name=None)

        rng4 = period_range('7/1/2000', '7/31/2000', freq='D', name='idx')
        expected4 = PeriodIndex([], freq='D', name='idx')

        for (rng, expected) in [(rng2, expected2), (rng3, expected3),
                                (rng4, expected4)]:
            result = base.intersection(rng)
            tm.assert_index_equal(result, expected)
            assert result.name == expected.name
            assert result.freq == 'D'

        # empty same freq
        rng = date_range('6/1/2000', '6/15/2000', freq='T')
        result = rng[0:0].intersection(rng)
        assert len(result) == 0

        result = rng.intersection(rng[0:0])
        assert len(result) == 0

    def test_difference(self):
        # diff
        rng1 = pd.period_range('1/1/2000', freq='D', periods=5)
        other1 = pd.period_range('1/6/2000', freq='D', periods=5)
        expected1 = pd.period_range('1/1/2000', freq='D', periods=5)

        rng2 = pd.period_range('1/1/2000', freq='D', periods=5)
        other2 = pd.period_range('1/4/2000', freq='D', periods=5)
        expected2 = pd.period_range('1/1/2000', freq='D', periods=3)

        rng3 = pd.period_range('1/1/2000', freq='D', periods=5)
        other3 = pd.PeriodIndex([], freq='D')
        expected3 = pd.period_range('1/1/2000', freq='D', periods=5)

        rng4 = pd.period_range('2000-01-01 09:00', freq='H', periods=5)
        other4 = pd.period_range('2000-01-02 09:00', freq='H', periods=5)
        expected4 = rng4

        rng5 = pd.PeriodIndex(['2000-01-01 09:01', '2000-01-01 09:03',
                               '2000-01-01 09:05'], freq='T')
        other5 = pd.PeriodIndex(
            ['2000-01-01 09:01', '2000-01-01 09:05'], freq='T')
        expected5 = pd.PeriodIndex(['2000-01-01 09:03'], freq='T')

        rng6 = pd.period_range('2000-01-01', freq='M', periods=7)
        other6 = pd.period_range('2000-04-01', freq='M', periods=7)
        expected6 = pd.period_range('2000-01-01', freq='M', periods=3)

        rng7 = pd.period_range('2003-01-01', freq='A', periods=5)
        other7 = pd.period_range('1998-01-01', freq='A', periods=8)
        expected7 = pd.period_range('2006-01-01', freq='A', periods=2)

        for rng, other, expected in [(rng1, other1, expected1),
                                     (rng2, other2, expected2),
                                     (rng3, other3, expected3),
                                     (rng4, other4, expected4),
                                     (rng5, other5, expected5),
                                     (rng6, other6, expected6),
                                     (rng7, other7, expected7), ]:
            result_union = rng.difference(other)
            tm.assert_index_equal(result_union, expected)
