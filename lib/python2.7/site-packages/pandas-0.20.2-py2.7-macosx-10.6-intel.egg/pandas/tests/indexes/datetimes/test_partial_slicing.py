""" test partial slicing on Series/Frame """

import pytest

from datetime import datetime
import numpy as np
import pandas as pd

from pandas import (DatetimeIndex, Series, DataFrame,
                    date_range, Index, Timedelta, Timestamp)
from pandas.util import testing as tm


class TestSlicing(object):

    def test_slice_year(self):
        dti = DatetimeIndex(freq='B', start=datetime(2005, 1, 1), periods=500)

        s = Series(np.arange(len(dti)), index=dti)
        result = s['2005']
        expected = s[s.index.year == 2005]
        tm.assert_series_equal(result, expected)

        df = DataFrame(np.random.rand(len(dti), 5), index=dti)
        result = df.loc['2005']
        expected = df[df.index.year == 2005]
        tm.assert_frame_equal(result, expected)

        rng = date_range('1/1/2000', '1/1/2010')

        result = rng.get_loc('2009')
        expected = slice(3288, 3653)
        assert result == expected

    def test_slice_quarter(self):
        dti = DatetimeIndex(freq='D', start=datetime(2000, 6, 1), periods=500)

        s = Series(np.arange(len(dti)), index=dti)
        assert len(s['2001Q1']) == 90

        df = DataFrame(np.random.rand(len(dti), 5), index=dti)
        assert len(df.loc['1Q01']) == 90

    def test_slice_month(self):
        dti = DatetimeIndex(freq='D', start=datetime(2005, 1, 1), periods=500)
        s = Series(np.arange(len(dti)), index=dti)
        assert len(s['2005-11']) == 30

        df = DataFrame(np.random.rand(len(dti), 5), index=dti)
        assert len(df.loc['2005-11']) == 30

        tm.assert_series_equal(s['2005-11'], s['11-2005'])

    def test_partial_slice(self):
        rng = DatetimeIndex(freq='D', start=datetime(2005, 1, 1), periods=500)
        s = Series(np.arange(len(rng)), index=rng)

        result = s['2005-05':'2006-02']
        expected = s['20050501':'20060228']
        tm.assert_series_equal(result, expected)

        result = s['2005-05':]
        expected = s['20050501':]
        tm.assert_series_equal(result, expected)

        result = s[:'2006-02']
        expected = s[:'20060228']
        tm.assert_series_equal(result, expected)

        result = s['2005-1-1']
        assert result == s.iloc[0]

        pytest.raises(Exception, s.__getitem__, '2004-12-31')

    def test_partial_slice_daily(self):
        rng = DatetimeIndex(freq='H', start=datetime(2005, 1, 31), periods=500)
        s = Series(np.arange(len(rng)), index=rng)

        result = s['2005-1-31']
        tm.assert_series_equal(result, s.iloc[:24])

        pytest.raises(Exception, s.__getitem__, '2004-12-31 00')

    def test_partial_slice_hourly(self):
        rng = DatetimeIndex(freq='T', start=datetime(2005, 1, 1, 20, 0, 0),
                            periods=500)
        s = Series(np.arange(len(rng)), index=rng)

        result = s['2005-1-1']
        tm.assert_series_equal(result, s.iloc[:60 * 4])

        result = s['2005-1-1 20']
        tm.assert_series_equal(result, s.iloc[:60])

        assert s['2005-1-1 20:00'] == s.iloc[0]
        pytest.raises(Exception, s.__getitem__, '2004-12-31 00:15')

    def test_partial_slice_minutely(self):
        rng = DatetimeIndex(freq='S', start=datetime(2005, 1, 1, 23, 59, 0),
                            periods=500)
        s = Series(np.arange(len(rng)), index=rng)

        result = s['2005-1-1 23:59']
        tm.assert_series_equal(result, s.iloc[:60])

        result = s['2005-1-1']
        tm.assert_series_equal(result, s.iloc[:60])

        assert s[Timestamp('2005-1-1 23:59:00')] == s.iloc[0]
        pytest.raises(Exception, s.__getitem__, '2004-12-31 00:00:00')

    def test_partial_slice_second_precision(self):
        rng = DatetimeIndex(start=datetime(2005, 1, 1, 0, 0, 59,
                                           microsecond=999990),
                            periods=20, freq='US')
        s = Series(np.arange(20), rng)

        tm.assert_series_equal(s['2005-1-1 00:00'], s.iloc[:10])
        tm.assert_series_equal(s['2005-1-1 00:00:59'], s.iloc[:10])

        tm.assert_series_equal(s['2005-1-1 00:01'], s.iloc[10:])
        tm.assert_series_equal(s['2005-1-1 00:01:00'], s.iloc[10:])

        assert s[Timestamp('2005-1-1 00:00:59.999990')] == s.iloc[0]
        tm.assert_raises_regex(KeyError, '2005-1-1 00:00:00',
                               lambda: s['2005-1-1 00:00:00'])

    def test_partial_slicing_dataframe(self):
        # GH14856
        # Test various combinations of string slicing resolution vs.
        # index resolution
        # - If string resolution is less precise than index resolution,
        # string is considered a slice
        # - If string resolution is equal to or more precise than index
        # resolution, string is considered an exact match
        formats = ['%Y', '%Y-%m', '%Y-%m-%d', '%Y-%m-%d %H',
                   '%Y-%m-%d %H:%M', '%Y-%m-%d %H:%M:%S']
        resolutions = ['year', 'month', 'day', 'hour', 'minute', 'second']
        for rnum, resolution in enumerate(resolutions[2:], 2):
            # we check only 'day', 'hour', 'minute' and 'second'
            unit = Timedelta("1 " + resolution)
            middate = datetime(2012, 1, 1, 0, 0, 0)
            index = DatetimeIndex([middate - unit,
                                   middate, middate + unit])
            values = [1, 2, 3]
            df = DataFrame({'a': values}, index, dtype=np.int64)
            assert df.index.resolution == resolution

            # Timestamp with the same resolution as index
            # Should be exact match for Series (return scalar)
            # and raise KeyError for Frame
            for timestamp, expected in zip(index, values):
                ts_string = timestamp.strftime(formats[rnum])
                # make ts_string as precise as index
                result = df['a'][ts_string]
                assert isinstance(result, np.int64)
                assert result == expected
                pytest.raises(KeyError, df.__getitem__, ts_string)

            # Timestamp with resolution less precise than index
            for fmt in formats[:rnum]:
                for element, theslice in [[0, slice(None, 1)],
                                          [1, slice(1, None)]]:
                    ts_string = index[element].strftime(fmt)

                    # Series should return slice
                    result = df['a'][ts_string]
                    expected = df['a'][theslice]
                    tm.assert_series_equal(result, expected)

                    # Frame should return slice as well
                    result = df[ts_string]
                    expected = df[theslice]
                    tm.assert_frame_equal(result, expected)

            # Timestamp with resolution more precise than index
            # Compatible with existing key
            # Should return scalar for Series
            # and raise KeyError for Frame
            for fmt in formats[rnum + 1:]:
                ts_string = index[1].strftime(fmt)
                result = df['a'][ts_string]
                assert isinstance(result, np.int64)
                assert result == 2
                pytest.raises(KeyError, df.__getitem__, ts_string)

            # Not compatible with existing key
            # Should raise KeyError
            for fmt, res in list(zip(formats, resolutions))[rnum + 1:]:
                ts = index[1] + Timedelta("1 " + res)
                ts_string = ts.strftime(fmt)
                pytest.raises(KeyError, df['a'].__getitem__, ts_string)
                pytest.raises(KeyError, df.__getitem__, ts_string)

    def test_partial_slicing_with_multiindex(self):

        # GH 4758
        # partial string indexing with a multi-index buggy
        df = DataFrame({'ACCOUNT': ["ACCT1", "ACCT1", "ACCT1", "ACCT2"],
                        'TICKER': ["ABC", "MNP", "XYZ", "XYZ"],
                        'val': [1, 2, 3, 4]},
                       index=date_range("2013-06-19 09:30:00",
                                        periods=4, freq='5T'))
        df_multi = df.set_index(['ACCOUNT', 'TICKER'], append=True)

        expected = DataFrame([
            [1]
        ], index=Index(['ABC'], name='TICKER'), columns=['val'])
        result = df_multi.loc[('2013-06-19 09:30:00', 'ACCT1')]
        tm.assert_frame_equal(result, expected)

        expected = df_multi.loc[
            (pd.Timestamp('2013-06-19 09:30:00', tz=None), 'ACCT1', 'ABC')]
        result = df_multi.loc[('2013-06-19 09:30:00', 'ACCT1', 'ABC')]
        tm.assert_series_equal(result, expected)

        # this is a KeyError as we don't do partial string selection on
        # multi-levels
        def f():
            df_multi.loc[('2013-06-19', 'ACCT1', 'ABC')]

        pytest.raises(KeyError, f)

        # GH 4294
        # partial slice on a series mi
        s = pd.DataFrame(np.random.rand(1000, 1000), index=pd.date_range(
            '2000-1-1', periods=1000)).stack()

        s2 = s[:-1].copy()
        expected = s2['2000-1-4']
        result = s2[pd.Timestamp('2000-1-4')]
        tm.assert_series_equal(result, expected)

        result = s[pd.Timestamp('2000-1-4')]
        expected = s['2000-1-4']
        tm.assert_series_equal(result, expected)

        df2 = pd.DataFrame(s)
        expected = df2.xs('2000-1-4')
        result = df2.loc[pd.Timestamp('2000-1-4')]
        tm.assert_frame_equal(result, expected)

    def test_partial_slice_doesnt_require_monotonicity(self):
        # For historical reasons.
        s = pd.Series(np.arange(10), pd.date_range('2014-01-01', periods=10))

        nonmonotonic = s[[3, 5, 4]]
        expected = nonmonotonic.iloc[:0]
        timestamp = pd.Timestamp('2014-01-10')

        tm.assert_series_equal(nonmonotonic['2014-01-10':], expected)
        tm.assert_raises_regex(KeyError,
                               r"Timestamp\('2014-01-10 00:00:00'\)",
                               lambda: nonmonotonic[timestamp:])

        tm.assert_series_equal(nonmonotonic.loc['2014-01-10':], expected)
        tm.assert_raises_regex(KeyError,
                               r"Timestamp\('2014-01-10 00:00:00'\)",
                               lambda: nonmonotonic.loc[timestamp:])

    def test_loc_datetime_length_one(self):
        # GH16071
        df = pd.DataFrame(columns=['1'],
                          index=pd.date_range('2016-10-01T00:00:00',
                                              '2016-10-01T23:59:59'))
        result = df.loc[datetime(2016, 10, 1):]
        tm.assert_frame_equal(result, df)

        result = df.loc['2016-10-01T00:00:00':]
        tm.assert_frame_equal(result, df)
