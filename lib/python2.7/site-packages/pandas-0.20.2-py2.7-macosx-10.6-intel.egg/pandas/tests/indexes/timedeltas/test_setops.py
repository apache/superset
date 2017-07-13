import numpy as np

import pandas as pd
import pandas.util.testing as tm
from pandas import TimedeltaIndex, timedelta_range, Int64Index


class TestTimedeltaIndex(object):
    _multiprocess_can_split_ = True

    def test_union(self):

        i1 = timedelta_range('1day', periods=5)
        i2 = timedelta_range('3day', periods=5)
        result = i1.union(i2)
        expected = timedelta_range('1day', periods=7)
        tm.assert_index_equal(result, expected)

        i1 = Int64Index(np.arange(0, 20, 2))
        i2 = TimedeltaIndex(start='1 day', periods=10, freq='D')
        i1.union(i2)  # Works
        i2.union(i1)  # Fails with "AttributeError: can't set attribute"

    def test_union_coverage(self):

        idx = TimedeltaIndex(['3d', '1d', '2d'])
        ordered = TimedeltaIndex(idx.sort_values(), freq='infer')
        result = ordered.union(idx)
        tm.assert_index_equal(result, ordered)

        result = ordered[:0].union(ordered)
        tm.assert_index_equal(result, ordered)
        assert result.freq == ordered.freq

    def test_union_bug_1730(self):

        rng_a = timedelta_range('1 day', periods=4, freq='3H')
        rng_b = timedelta_range('1 day', periods=4, freq='4H')

        result = rng_a.union(rng_b)
        exp = TimedeltaIndex(sorted(set(list(rng_a)) | set(list(rng_b))))
        tm.assert_index_equal(result, exp)

    def test_union_bug_1745(self):

        left = TimedeltaIndex(['1 day 15:19:49.695000'])
        right = TimedeltaIndex(['2 day 13:04:21.322000',
                                '1 day 15:27:24.873000',
                                '1 day 15:31:05.350000'])

        result = left.union(right)
        exp = TimedeltaIndex(sorted(set(list(left)) | set(list(right))))
        tm.assert_index_equal(result, exp)

    def test_union_bug_4564(self):

        left = timedelta_range("1 day", "30d")
        right = left + pd.offsets.Minute(15)

        result = left.union(right)
        exp = TimedeltaIndex(sorted(set(list(left)) | set(list(right))))
        tm.assert_index_equal(result, exp)

    def test_intersection_bug_1708(self):
        index_1 = timedelta_range('1 day', periods=4, freq='h')
        index_2 = index_1 + pd.offsets.Hour(5)

        result = index_1 & index_2
        assert len(result) == 0

        index_1 = timedelta_range('1 day', periods=4, freq='h')
        index_2 = index_1 + pd.offsets.Hour(1)

        result = index_1 & index_2
        expected = timedelta_range('1 day 01:00:00', periods=3, freq='h')
        tm.assert_index_equal(result, expected)
