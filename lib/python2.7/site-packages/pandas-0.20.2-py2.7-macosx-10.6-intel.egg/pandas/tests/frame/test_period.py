import numpy as np
from numpy.random import randn
from datetime import timedelta

import pandas as pd
import pandas.util.testing as tm
from pandas import (PeriodIndex, period_range, DataFrame, date_range,
                    Index, to_datetime, DatetimeIndex)


def _permute(obj):
    return obj.take(np.random.permutation(len(obj)))


class TestPeriodIndex(object):

    def setup_method(self, method):
        pass

    def test_as_frame_columns(self):
        rng = period_range('1/1/2000', periods=5)
        df = DataFrame(randn(10, 5), columns=rng)

        ts = df[rng[0]]
        tm.assert_series_equal(ts, df.iloc[:, 0])

        # GH # 1211
        repr(df)

        ts = df['1/1/2000']
        tm.assert_series_equal(ts, df.iloc[:, 0])

    def test_frame_setitem(self):
        rng = period_range('1/1/2000', periods=5, name='index')
        df = DataFrame(randn(5, 3), index=rng)

        df['Index'] = rng
        rs = Index(df['Index'])
        tm.assert_index_equal(rs, rng, check_names=False)
        assert rs.name == 'Index'
        assert rng.name == 'index'

        rs = df.reset_index().set_index('index')
        assert isinstance(rs.index, PeriodIndex)
        tm.assert_index_equal(rs.index, rng)

    def test_frame_to_time_stamp(self):
        K = 5
        index = PeriodIndex(freq='A', start='1/1/2001', end='12/1/2009')
        df = DataFrame(randn(len(index), K), index=index)
        df['mix'] = 'a'

        exp_index = date_range('1/1/2001', end='12/31/2009', freq='A-DEC')
        result = df.to_timestamp('D', 'end')
        tm.assert_index_equal(result.index, exp_index)
        tm.assert_numpy_array_equal(result.values, df.values)

        exp_index = date_range('1/1/2001', end='1/1/2009', freq='AS-JAN')
        result = df.to_timestamp('D', 'start')
        tm.assert_index_equal(result.index, exp_index)

        def _get_with_delta(delta, freq='A-DEC'):
            return date_range(to_datetime('1/1/2001') + delta,
                              to_datetime('12/31/2009') + delta, freq=freq)

        delta = timedelta(hours=23)
        result = df.to_timestamp('H', 'end')
        exp_index = _get_with_delta(delta)
        tm.assert_index_equal(result.index, exp_index)

        delta = timedelta(hours=23, minutes=59)
        result = df.to_timestamp('T', 'end')
        exp_index = _get_with_delta(delta)
        tm.assert_index_equal(result.index, exp_index)

        result = df.to_timestamp('S', 'end')
        delta = timedelta(hours=23, minutes=59, seconds=59)
        exp_index = _get_with_delta(delta)
        tm.assert_index_equal(result.index, exp_index)

        # columns
        df = df.T

        exp_index = date_range('1/1/2001', end='12/31/2009', freq='A-DEC')
        result = df.to_timestamp('D', 'end', axis=1)
        tm.assert_index_equal(result.columns, exp_index)
        tm.assert_numpy_array_equal(result.values, df.values)

        exp_index = date_range('1/1/2001', end='1/1/2009', freq='AS-JAN')
        result = df.to_timestamp('D', 'start', axis=1)
        tm.assert_index_equal(result.columns, exp_index)

        delta = timedelta(hours=23)
        result = df.to_timestamp('H', 'end', axis=1)
        exp_index = _get_with_delta(delta)
        tm.assert_index_equal(result.columns, exp_index)

        delta = timedelta(hours=23, minutes=59)
        result = df.to_timestamp('T', 'end', axis=1)
        exp_index = _get_with_delta(delta)
        tm.assert_index_equal(result.columns, exp_index)

        result = df.to_timestamp('S', 'end', axis=1)
        delta = timedelta(hours=23, minutes=59, seconds=59)
        exp_index = _get_with_delta(delta)
        tm.assert_index_equal(result.columns, exp_index)

        # invalid axis
        tm.assert_raises_regex(
            ValueError, 'axis', df.to_timestamp, axis=2)

        result1 = df.to_timestamp('5t', axis=1)
        result2 = df.to_timestamp('t', axis=1)
        expected = pd.date_range('2001-01-01', '2009-01-01', freq='AS')
        assert isinstance(result1.columns, DatetimeIndex)
        assert isinstance(result2.columns, DatetimeIndex)
        tm.assert_numpy_array_equal(result1.columns.asi8, expected.asi8)
        tm.assert_numpy_array_equal(result2.columns.asi8, expected.asi8)
        # PeriodIndex.to_timestamp always use 'infer'
        assert result1.columns.freqstr == 'AS-JAN'
        assert result2.columns.freqstr == 'AS-JAN'

    def test_frame_index_to_string(self):
        index = PeriodIndex(['2011-1', '2011-2', '2011-3'], freq='M')
        frame = DataFrame(np.random.randn(3, 4), index=index)

        # it works!
        frame.to_string()

    def test_align_frame(self):
        rng = period_range('1/1/2000', '1/1/2010', freq='A')
        ts = DataFrame(np.random.randn(len(rng), 3), index=rng)

        result = ts + ts[::2]
        expected = ts + ts
        expected.values[1::2] = np.nan
        tm.assert_frame_equal(result, expected)

        result = ts + _permute(ts[::2])
        tm.assert_frame_equal(result, expected)
