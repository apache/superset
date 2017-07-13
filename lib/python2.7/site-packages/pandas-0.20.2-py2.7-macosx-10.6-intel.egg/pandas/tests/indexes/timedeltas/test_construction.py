import pytest

import numpy as np
from datetime import timedelta

import pandas as pd
import pandas.util.testing as tm
from pandas import TimedeltaIndex, timedelta_range, to_timedelta


class TestTimedeltaIndex(object):
    _multiprocess_can_split_ = True

    def test_construction_base_constructor(self):
        arr = [pd.Timedelta('1 days'), pd.NaT, pd.Timedelta('3 days')]
        tm.assert_index_equal(pd.Index(arr), pd.TimedeltaIndex(arr))
        tm.assert_index_equal(pd.Index(np.array(arr)),
                              pd.TimedeltaIndex(np.array(arr)))

        arr = [np.nan, pd.NaT, pd.Timedelta('1 days')]
        tm.assert_index_equal(pd.Index(arr), pd.TimedeltaIndex(arr))
        tm.assert_index_equal(pd.Index(np.array(arr)),
                              pd.TimedeltaIndex(np.array(arr)))

    def test_constructor(self):
        expected = TimedeltaIndex(['1 days', '1 days 00:00:05', '2 days',
                                   '2 days 00:00:02', '0 days 00:00:03'])
        result = TimedeltaIndex(['1 days', '1 days, 00:00:05', np.timedelta64(
            2, 'D'), timedelta(days=2, seconds=2), pd.offsets.Second(3)])
        tm.assert_index_equal(result, expected)

        # unicode
        result = TimedeltaIndex([u'1 days', '1 days, 00:00:05', np.timedelta64(
            2, 'D'), timedelta(days=2, seconds=2), pd.offsets.Second(3)])

        expected = TimedeltaIndex(['0 days 00:00:00', '0 days 00:00:01',
                                   '0 days 00:00:02'])
        tm.assert_index_equal(TimedeltaIndex(range(3), unit='s'), expected)
        expected = TimedeltaIndex(['0 days 00:00:00', '0 days 00:00:05',
                                   '0 days 00:00:09'])
        tm.assert_index_equal(TimedeltaIndex([0, 5, 9], unit='s'), expected)
        expected = TimedeltaIndex(
            ['0 days 00:00:00.400', '0 days 00:00:00.450',
             '0 days 00:00:01.200'])
        tm.assert_index_equal(TimedeltaIndex([400, 450, 1200], unit='ms'),
                              expected)

    def test_constructor_coverage(self):
        rng = timedelta_range('1 days', periods=10.5)
        exp = timedelta_range('1 days', periods=10)
        tm.assert_index_equal(rng, exp)

        pytest.raises(ValueError, TimedeltaIndex, start='1 days',
                      periods='foo', freq='D')

        pytest.raises(ValueError, TimedeltaIndex, start='1 days',
                      end='10 days')

        pytest.raises(ValueError, TimedeltaIndex, '1 days')

        # generator expression
        gen = (timedelta(i) for i in range(10))
        result = TimedeltaIndex(gen)
        expected = TimedeltaIndex([timedelta(i) for i in range(10)])
        tm.assert_index_equal(result, expected)

        # NumPy string array
        strings = np.array(['1 days', '2 days', '3 days'])
        result = TimedeltaIndex(strings)
        expected = to_timedelta([1, 2, 3], unit='d')
        tm.assert_index_equal(result, expected)

        from_ints = TimedeltaIndex(expected.asi8)
        tm.assert_index_equal(from_ints, expected)

        # non-conforming freq
        pytest.raises(ValueError, TimedeltaIndex,
                      ['1 days', '2 days', '4 days'], freq='D')

        pytest.raises(ValueError, TimedeltaIndex, periods=10, freq='D')

    def test_constructor_name(self):
        idx = TimedeltaIndex(start='1 days', periods=1, freq='D', name='TEST')
        assert idx.name == 'TEST'

        # GH10025
        idx2 = TimedeltaIndex(idx, name='something else')
        assert idx2.name == 'something else'
