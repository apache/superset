import pytest

from datetime import timedelta

import pandas.util.testing as tm
from pandas import TimedeltaIndex, timedelta_range, compat, Index, Timedelta


class TestTimedeltaIndex(object):
    _multiprocess_can_split_ = True

    def test_insert(self):

        idx = TimedeltaIndex(['4day', '1day', '2day'], name='idx')

        result = idx.insert(2, timedelta(days=5))
        exp = TimedeltaIndex(['4day', '1day', '5day', '2day'], name='idx')
        tm.assert_index_equal(result, exp)

        # insertion of non-datetime should coerce to object index
        result = idx.insert(1, 'inserted')
        expected = Index([Timedelta('4day'), 'inserted', Timedelta('1day'),
                          Timedelta('2day')], name='idx')
        assert not isinstance(result, TimedeltaIndex)
        tm.assert_index_equal(result, expected)
        assert result.name == expected.name

        idx = timedelta_range('1day 00:00:01', periods=3, freq='s', name='idx')

        # preserve freq
        expected_0 = TimedeltaIndex(['1day', '1day 00:00:01', '1day 00:00:02',
                                     '1day 00:00:03'],
                                    name='idx', freq='s')
        expected_3 = TimedeltaIndex(['1day 00:00:01', '1day 00:00:02',
                                     '1day 00:00:03', '1day 00:00:04'],
                                    name='idx', freq='s')

        # reset freq to None
        expected_1_nofreq = TimedeltaIndex(['1day 00:00:01', '1day 00:00:01',
                                            '1day 00:00:02', '1day 00:00:03'],
                                           name='idx', freq=None)
        expected_3_nofreq = TimedeltaIndex(['1day 00:00:01', '1day 00:00:02',
                                            '1day 00:00:03', '1day 00:00:05'],
                                           name='idx', freq=None)

        cases = [(0, Timedelta('1day'), expected_0),
                 (-3, Timedelta('1day'), expected_0),
                 (3, Timedelta('1day 00:00:04'), expected_3),
                 (1, Timedelta('1day 00:00:01'), expected_1_nofreq),
                 (3, Timedelta('1day 00:00:05'), expected_3_nofreq)]

        for n, d, expected in cases:
            result = idx.insert(n, d)
            tm.assert_index_equal(result, expected)
            assert result.name == expected.name
            assert result.freq == expected.freq

    def test_delete(self):
        idx = timedelta_range(start='1 Days', periods=5, freq='D', name='idx')

        # prserve freq
        expected_0 = timedelta_range(start='2 Days', periods=4, freq='D',
                                     name='idx')
        expected_4 = timedelta_range(start='1 Days', periods=4, freq='D',
                                     name='idx')

        # reset freq to None
        expected_1 = TimedeltaIndex(
            ['1 day', '3 day', '4 day', '5 day'], freq=None, name='idx')

        cases = {0: expected_0,
                 -5: expected_0,
                 -1: expected_4,
                 4: expected_4,
                 1: expected_1}
        for n, expected in compat.iteritems(cases):
            result = idx.delete(n)
            tm.assert_index_equal(result, expected)
            assert result.name == expected.name
            assert result.freq == expected.freq

        with pytest.raises((IndexError, ValueError)):
            # either depeidnig on numpy version
            result = idx.delete(5)

    def test_delete_slice(self):
        idx = timedelta_range(start='1 days', periods=10, freq='D', name='idx')

        # prserve freq
        expected_0_2 = timedelta_range(start='4 days', periods=7, freq='D',
                                       name='idx')
        expected_7_9 = timedelta_range(start='1 days', periods=7, freq='D',
                                       name='idx')

        # reset freq to None
        expected_3_5 = TimedeltaIndex(['1 d', '2 d', '3 d',
                                       '7 d', '8 d', '9 d', '10d'],
                                      freq=None, name='idx')

        cases = {(0, 1, 2): expected_0_2,
                 (7, 8, 9): expected_7_9,
                 (3, 4, 5): expected_3_5}
        for n, expected in compat.iteritems(cases):
            result = idx.delete(n)
            tm.assert_index_equal(result, expected)
            assert result.name == expected.name
            assert result.freq == expected.freq

            result = idx.delete(slice(n[0], n[-1] + 1))
            tm.assert_index_equal(result, expected)
            assert result.name == expected.name
            assert result.freq == expected.freq
