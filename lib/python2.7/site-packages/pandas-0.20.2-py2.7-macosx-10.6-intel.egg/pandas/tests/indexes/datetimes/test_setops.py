from datetime import datetime

import numpy as np

import pandas as pd
import pandas.util.testing as tm
from pandas.core.indexes.datetimes import cdate_range
from pandas import (DatetimeIndex, date_range, Series, bdate_range, DataFrame,
                    Int64Index, Index, to_datetime)
from pandas.tseries.offsets import Minute, BMonthEnd, MonthEnd

START, END = datetime(2009, 1, 1), datetime(2010, 1, 1)


class TestDatetimeIndex(object):

    def test_union(self):
        i1 = Int64Index(np.arange(0, 20, 2))
        i2 = Int64Index(np.arange(10, 30, 2))
        result = i1.union(i2)
        expected = Int64Index(np.arange(0, 30, 2))
        tm.assert_index_equal(result, expected)

    def test_union_coverage(self):
        idx = DatetimeIndex(['2000-01-03', '2000-01-01', '2000-01-02'])
        ordered = DatetimeIndex(idx.sort_values(), freq='infer')
        result = ordered.union(idx)
        tm.assert_index_equal(result, ordered)

        result = ordered[:0].union(ordered)
        tm.assert_index_equal(result, ordered)
        assert result.freq == ordered.freq

    def test_union_bug_1730(self):
        rng_a = date_range('1/1/2012', periods=4, freq='3H')
        rng_b = date_range('1/1/2012', periods=4, freq='4H')

        result = rng_a.union(rng_b)
        exp = DatetimeIndex(sorted(set(list(rng_a)) | set(list(rng_b))))
        tm.assert_index_equal(result, exp)

    def test_union_bug_1745(self):
        left = DatetimeIndex(['2012-05-11 15:19:49.695000'])
        right = DatetimeIndex(['2012-05-29 13:04:21.322000',
                               '2012-05-11 15:27:24.873000',
                               '2012-05-11 15:31:05.350000'])

        result = left.union(right)
        exp = DatetimeIndex(sorted(set(list(left)) | set(list(right))))
        tm.assert_index_equal(result, exp)

    def test_union_bug_4564(self):
        from pandas import DateOffset
        left = date_range("2013-01-01", "2013-02-01")
        right = left + DateOffset(minutes=15)

        result = left.union(right)
        exp = DatetimeIndex(sorted(set(list(left)) | set(list(right))))
        tm.assert_index_equal(result, exp)

    def test_union_freq_both_none(self):
        # GH11086
        expected = bdate_range('20150101', periods=10)
        expected.freq = None

        result = expected.union(expected)
        tm.assert_index_equal(result, expected)
        assert result.freq is None

    def test_union_dataframe_index(self):
        rng1 = date_range('1/1/1999', '1/1/2012', freq='MS')
        s1 = Series(np.random.randn(len(rng1)), rng1)

        rng2 = date_range('1/1/1980', '12/1/2001', freq='MS')
        s2 = Series(np.random.randn(len(rng2)), rng2)
        df = DataFrame({'s1': s1, 's2': s2})

        exp = pd.date_range('1/1/1980', '1/1/2012', freq='MS')
        tm.assert_index_equal(df.index, exp)

    def test_union_with_DatetimeIndex(self):
        i1 = Int64Index(np.arange(0, 20, 2))
        i2 = DatetimeIndex(start='2012-01-03 00:00:00', periods=10, freq='D')
        i1.union(i2)  # Works
        i2.union(i1)  # Fails with "AttributeError: can't set attribute"

    def test_intersection(self):
        # GH 4690 (with tz)
        for tz in [None, 'Asia/Tokyo', 'US/Eastern', 'dateutil/US/Pacific']:
            base = date_range('6/1/2000', '6/30/2000', freq='D', name='idx')

            # if target has the same name, it is preserved
            rng2 = date_range('5/15/2000', '6/20/2000', freq='D', name='idx')
            expected2 = date_range('6/1/2000', '6/20/2000', freq='D',
                                   name='idx')

            # if target name is different, it will be reset
            rng3 = date_range('5/15/2000', '6/20/2000', freq='D', name='other')
            expected3 = date_range('6/1/2000', '6/20/2000', freq='D',
                                   name=None)

            rng4 = date_range('7/1/2000', '7/31/2000', freq='D', name='idx')
            expected4 = DatetimeIndex([], name='idx')

            for (rng, expected) in [(rng2, expected2), (rng3, expected3),
                                    (rng4, expected4)]:
                result = base.intersection(rng)
                tm.assert_index_equal(result, expected)
                assert result.name == expected.name
                assert result.freq == expected.freq
                assert result.tz == expected.tz

            # non-monotonic
            base = DatetimeIndex(['2011-01-05', '2011-01-04',
                                  '2011-01-02', '2011-01-03'],
                                 tz=tz, name='idx')

            rng2 = DatetimeIndex(['2011-01-04', '2011-01-02',
                                  '2011-02-02', '2011-02-03'],
                                 tz=tz, name='idx')
            expected2 = DatetimeIndex(
                ['2011-01-04', '2011-01-02'], tz=tz, name='idx')

            rng3 = DatetimeIndex(['2011-01-04', '2011-01-02',
                                  '2011-02-02', '2011-02-03'],
                                 tz=tz, name='other')
            expected3 = DatetimeIndex(
                ['2011-01-04', '2011-01-02'], tz=tz, name=None)

            # GH 7880
            rng4 = date_range('7/1/2000', '7/31/2000', freq='D', tz=tz,
                              name='idx')
            expected4 = DatetimeIndex([], tz=tz, name='idx')

            for (rng, expected) in [(rng2, expected2), (rng3, expected3),
                                    (rng4, expected4)]:
                result = base.intersection(rng)
                tm.assert_index_equal(result, expected)
                assert result.name == expected.name
                assert result.freq is None
                assert result.tz == expected.tz

        # empty same freq GH2129
        rng = date_range('6/1/2000', '6/15/2000', freq='T')
        result = rng[0:0].intersection(rng)
        assert len(result) == 0

        result = rng.intersection(rng[0:0])
        assert len(result) == 0

    def test_intersection_bug_1708(self):
        from pandas import DateOffset
        index_1 = date_range('1/1/2012', periods=4, freq='12H')
        index_2 = index_1 + DateOffset(hours=1)

        result = index_1 & index_2
        assert len(result) == 0

    def test_difference_freq(self):
        # GH14323: difference of DatetimeIndex should not preserve frequency

        index = date_range("20160920", "20160925", freq="D")
        other = date_range("20160921", "20160924", freq="D")
        expected = DatetimeIndex(["20160920", "20160925"], freq=None)
        idx_diff = index.difference(other)
        tm.assert_index_equal(idx_diff, expected)
        tm.assert_attr_equal('freq', idx_diff, expected)

        other = date_range("20160922", "20160925", freq="D")
        idx_diff = index.difference(other)
        expected = DatetimeIndex(["20160920", "20160921"], freq=None)
        tm.assert_index_equal(idx_diff, expected)
        tm.assert_attr_equal('freq', idx_diff, expected)

    def test_datetimeindex_diff(self):
        dti1 = DatetimeIndex(freq='Q-JAN', start=datetime(1997, 12, 31),
                             periods=100)
        dti2 = DatetimeIndex(freq='Q-JAN', start=datetime(1997, 12, 31),
                             periods=98)
        assert len(dti1.difference(dti2)) == 2

    def test_datetimeindex_union_join_empty(self):
        dti = DatetimeIndex(start='1/1/2001', end='2/1/2001', freq='D')
        empty = Index([])

        result = dti.union(empty)
        assert isinstance(result, DatetimeIndex)
        assert result is result

        result = dti.join(empty)
        assert isinstance(result, DatetimeIndex)

    def test_join_nonunique(self):
        idx1 = to_datetime(['2012-11-06 16:00:11.477563',
                            '2012-11-06 16:00:11.477563'])
        idx2 = to_datetime(['2012-11-06 15:11:09.006507',
                            '2012-11-06 15:11:09.006507'])
        rs = idx1.join(idx2, how='outer')
        assert rs.is_monotonic


class TestBusinessDatetimeIndex(object):

    def setup_method(self, method):
        self.rng = bdate_range(START, END)

    def test_union(self):
        # overlapping
        left = self.rng[:10]
        right = self.rng[5:10]

        the_union = left.union(right)
        assert isinstance(the_union, DatetimeIndex)

        # non-overlapping, gap in middle
        left = self.rng[:5]
        right = self.rng[10:]

        the_union = left.union(right)
        assert isinstance(the_union, Index)

        # non-overlapping, no gap
        left = self.rng[:5]
        right = self.rng[5:10]

        the_union = left.union(right)
        assert isinstance(the_union, DatetimeIndex)

        # order does not matter
        tm.assert_index_equal(right.union(left), the_union)

        # overlapping, but different offset
        rng = date_range(START, END, freq=BMonthEnd())

        the_union = self.rng.union(rng)
        assert isinstance(the_union, DatetimeIndex)

    def test_outer_join(self):
        # should just behave as union

        # overlapping
        left = self.rng[:10]
        right = self.rng[5:10]

        the_join = left.join(right, how='outer')
        assert isinstance(the_join, DatetimeIndex)

        # non-overlapping, gap in middle
        left = self.rng[:5]
        right = self.rng[10:]

        the_join = left.join(right, how='outer')
        assert isinstance(the_join, DatetimeIndex)
        assert the_join.freq is None

        # non-overlapping, no gap
        left = self.rng[:5]
        right = self.rng[5:10]

        the_join = left.join(right, how='outer')
        assert isinstance(the_join, DatetimeIndex)

        # overlapping, but different offset
        rng = date_range(START, END, freq=BMonthEnd())

        the_join = self.rng.join(rng, how='outer')
        assert isinstance(the_join, DatetimeIndex)
        assert the_join.freq is None

    def test_union_not_cacheable(self):
        rng = date_range('1/1/2000', periods=50, freq=Minute())
        rng1 = rng[10:]
        rng2 = rng[:25]
        the_union = rng1.union(rng2)
        tm.assert_index_equal(the_union, rng)

        rng1 = rng[10:]
        rng2 = rng[15:35]
        the_union = rng1.union(rng2)
        expected = rng[10:]
        tm.assert_index_equal(the_union, expected)

    def test_intersection(self):
        rng = date_range('1/1/2000', periods=50, freq=Minute())
        rng1 = rng[10:]
        rng2 = rng[:25]
        the_int = rng1.intersection(rng2)
        expected = rng[10:25]
        tm.assert_index_equal(the_int, expected)
        assert isinstance(the_int, DatetimeIndex)
        assert the_int.offset == rng.offset

        the_int = rng1.intersection(rng2.view(DatetimeIndex))
        tm.assert_index_equal(the_int, expected)

        # non-overlapping
        the_int = rng[:10].intersection(rng[10:])
        expected = DatetimeIndex([])
        tm.assert_index_equal(the_int, expected)

    def test_intersection_bug(self):
        # GH #771
        a = bdate_range('11/30/2011', '12/31/2011')
        b = bdate_range('12/10/2011', '12/20/2011')
        result = a.intersection(b)
        tm.assert_index_equal(result, b)

    def test_month_range_union_tz_pytz(self):
        tm._skip_if_no_pytz()
        from pytz import timezone
        tz = timezone('US/Eastern')

        early_start = datetime(2011, 1, 1)
        early_end = datetime(2011, 3, 1)

        late_start = datetime(2011, 3, 1)
        late_end = datetime(2011, 5, 1)

        early_dr = date_range(start=early_start, end=early_end, tz=tz,
                              freq=MonthEnd())
        late_dr = date_range(start=late_start, end=late_end, tz=tz,
                             freq=MonthEnd())

        early_dr.union(late_dr)

    def test_month_range_union_tz_dateutil(self):
        tm._skip_if_windows_python_3()
        tm._skip_if_no_dateutil()
        from pandas._libs.tslib import _dateutil_gettz as timezone
        tz = timezone('US/Eastern')

        early_start = datetime(2011, 1, 1)
        early_end = datetime(2011, 3, 1)

        late_start = datetime(2011, 3, 1)
        late_end = datetime(2011, 5, 1)

        early_dr = date_range(start=early_start, end=early_end, tz=tz,
                              freq=MonthEnd())
        late_dr = date_range(start=late_start, end=late_end, tz=tz,
                             freq=MonthEnd())

        early_dr.union(late_dr)


class TestCustomDatetimeIndex(object):

    def setup_method(self, method):
        self.rng = cdate_range(START, END)

    def test_union(self):
        # overlapping
        left = self.rng[:10]
        right = self.rng[5:10]

        the_union = left.union(right)
        assert isinstance(the_union, DatetimeIndex)

        # non-overlapping, gap in middle
        left = self.rng[:5]
        right = self.rng[10:]

        the_union = left.union(right)
        assert isinstance(the_union, Index)

        # non-overlapping, no gap
        left = self.rng[:5]
        right = self.rng[5:10]

        the_union = left.union(right)
        assert isinstance(the_union, DatetimeIndex)

        # order does not matter
        tm.assert_index_equal(right.union(left), the_union)

        # overlapping, but different offset
        rng = date_range(START, END, freq=BMonthEnd())

        the_union = self.rng.union(rng)
        assert isinstance(the_union, DatetimeIndex)

    def test_outer_join(self):
        # should just behave as union

        # overlapping
        left = self.rng[:10]
        right = self.rng[5:10]

        the_join = left.join(right, how='outer')
        assert isinstance(the_join, DatetimeIndex)

        # non-overlapping, gap in middle
        left = self.rng[:5]
        right = self.rng[10:]

        the_join = left.join(right, how='outer')
        assert isinstance(the_join, DatetimeIndex)
        assert the_join.freq is None

        # non-overlapping, no gap
        left = self.rng[:5]
        right = self.rng[5:10]

        the_join = left.join(right, how='outer')
        assert isinstance(the_join, DatetimeIndex)

        # overlapping, but different offset
        rng = date_range(START, END, freq=BMonthEnd())

        the_join = self.rng.join(rng, how='outer')
        assert isinstance(the_join, DatetimeIndex)
        assert the_join.freq is None

    def test_intersection_bug(self):
        # GH #771
        a = cdate_range('11/30/2011', '12/31/2011')
        b = cdate_range('12/10/2011', '12/20/2011')
        result = a.intersection(b)
        tm.assert_index_equal(result, b)
