import pytest

import numpy as np
import pandas.util.testing as tm

import pandas as pd
from pandas import Series, timedelta_range, Timedelta
from pandas.util.testing import assert_series_equal


class TestSlicing(object):

    def test_partial_slice(self):
        rng = timedelta_range('1 day 10:11:12', freq='h', periods=500)
        s = Series(np.arange(len(rng)), index=rng)

        result = s['5 day':'6 day']
        expected = s.iloc[86:134]
        assert_series_equal(result, expected)

        result = s['5 day':]
        expected = s.iloc[86:]
        assert_series_equal(result, expected)

        result = s[:'6 day']
        expected = s.iloc[:134]
        assert_series_equal(result, expected)

        result = s['6 days, 23:11:12']
        assert result == s.iloc[133]

        pytest.raises(KeyError, s.__getitem__, '50 days')

    def test_partial_slice_high_reso(self):

        # higher reso
        rng = timedelta_range('1 day 10:11:12', freq='us', periods=2000)
        s = Series(np.arange(len(rng)), index=rng)

        result = s['1 day 10:11:12':]
        expected = s.iloc[0:]
        assert_series_equal(result, expected)

        result = s['1 day 10:11:12.001':]
        expected = s.iloc[1000:]
        assert_series_equal(result, expected)

        result = s['1 days, 10:11:12.001001']
        assert result == s.iloc[1001]

    def test_slice_with_negative_step(self):
        ts = Series(np.arange(20), timedelta_range('0', periods=20, freq='H'))
        SLC = pd.IndexSlice

        def assert_slices_equivalent(l_slc, i_slc):
            assert_series_equal(ts[l_slc], ts.iloc[i_slc])
            assert_series_equal(ts.loc[l_slc], ts.iloc[i_slc])
            assert_series_equal(ts.loc[l_slc], ts.iloc[i_slc])

        assert_slices_equivalent(SLC[Timedelta(hours=7)::-1], SLC[7::-1])
        assert_slices_equivalent(SLC['7 hours'::-1], SLC[7::-1])

        assert_slices_equivalent(SLC[:Timedelta(hours=7):-1], SLC[:6:-1])
        assert_slices_equivalent(SLC[:'7 hours':-1], SLC[:6:-1])

        assert_slices_equivalent(SLC['15 hours':'7 hours':-1], SLC[15:6:-1])
        assert_slices_equivalent(SLC[Timedelta(hours=15):Timedelta(hours=7):-
                                     1], SLC[15:6:-1])
        assert_slices_equivalent(SLC['15 hours':Timedelta(hours=7):-1],
                                 SLC[15:6:-1])
        assert_slices_equivalent(SLC[Timedelta(hours=15):'7 hours':-1],
                                 SLC[15:6:-1])

        assert_slices_equivalent(SLC['7 hours':'15 hours':-1], SLC[:0])

    def test_slice_with_zero_step_raises(self):
        ts = Series(np.arange(20), timedelta_range('0', periods=20, freq='H'))
        tm.assert_raises_regex(ValueError, 'slice step cannot be zero',
                               lambda: ts[::0])
        tm.assert_raises_regex(ValueError, 'slice step cannot be zero',
                               lambda: ts.loc[::0])
        tm.assert_raises_regex(ValueError, 'slice step cannot be zero',
                               lambda: ts.loc[::0])
