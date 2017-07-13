import numpy as np

import pandas as pd
import pandas.util.testing as tm
import pandas.core.indexes.period as period
from pandas import Series, period_range, DataFrame, Period


def _permute(obj):
    return obj.take(np.random.permutation(len(obj)))


class TestSeriesPeriod(object):

    def setup_method(self, method):
        self.series = Series(period_range('2000-01-01', periods=10, freq='D'))

    def test_auto_conversion(self):
        series = Series(list(period_range('2000-01-01', periods=10, freq='D')))
        assert series.dtype == 'object'

        series = pd.Series([pd.Period('2011-01-01', freq='D'),
                            pd.Period('2011-02-01', freq='D')])
        assert series.dtype == 'object'

    def test_getitem(self):
        assert self.series[1] == pd.Period('2000-01-02', freq='D')

        result = self.series[[2, 4]]
        exp = pd.Series([pd.Period('2000-01-03', freq='D'),
                         pd.Period('2000-01-05', freq='D')],
                        index=[2, 4])
        tm.assert_series_equal(result, exp)
        assert result.dtype == 'object'

    def test_isnull(self):
        # GH 13737
        s = Series([pd.Period('2011-01', freq='M'),
                    pd.Period('NaT', freq='M')])
        tm.assert_series_equal(s.isnull(), Series([False, True]))
        tm.assert_series_equal(s.notnull(), Series([True, False]))

    def test_fillna(self):
        # GH 13737
        s = Series([pd.Period('2011-01', freq='M'),
                    pd.Period('NaT', freq='M')])

        res = s.fillna(pd.Period('2012-01', freq='M'))
        exp = Series([pd.Period('2011-01', freq='M'),
                      pd.Period('2012-01', freq='M')])
        tm.assert_series_equal(res, exp)
        assert res.dtype == 'object'

        res = s.fillna('XXX')
        exp = Series([pd.Period('2011-01', freq='M'), 'XXX'])
        tm.assert_series_equal(res, exp)
        assert res.dtype == 'object'

    def test_dropna(self):
        # GH 13737
        s = Series([pd.Period('2011-01', freq='M'),
                    pd.Period('NaT', freq='M')])
        tm.assert_series_equal(s.dropna(),
                               Series([pd.Period('2011-01', freq='M')]))

    def test_series_comparison_scalars(self):
        val = pd.Period('2000-01-04', freq='D')
        result = self.series > val
        expected = pd.Series([x > val for x in self.series])
        tm.assert_series_equal(result, expected)

        val = self.series[5]
        result = self.series > val
        expected = pd.Series([x > val for x in self.series])
        tm.assert_series_equal(result, expected)

    def test_between(self):
        left, right = self.series[[2, 7]]
        result = self.series.between(left, right)
        expected = (self.series >= left) & (self.series <= right)
        tm.assert_series_equal(result, expected)

    # ---------------------------------------------------------------------
    # NaT support

    """
    # ToDo: Enable when support period dtype
    def test_NaT_scalar(self):
        series = Series([0, 1000, 2000, iNaT], dtype='period[D]')

        val = series[3]
        assert isnull(val)

        series[2] = val
        assert isnull(series[2])

    def test_NaT_cast(self):
        result = Series([np.nan]).astype('period[D]')
        expected = Series([NaT])
        tm.assert_series_equal(result, expected)
    """

    def test_set_none_nan(self):
        # currently Period is stored as object dtype, not as NaT
        self.series[3] = None
        assert self.series[3] is None

        self.series[3:5] = None
        assert self.series[4] is None

        self.series[5] = np.nan
        assert np.isnan(self.series[5])

        self.series[5:7] = np.nan
        assert np.isnan(self.series[6])

    def test_intercept_astype_object(self):
        expected = self.series.astype('object')

        df = DataFrame({'a': self.series,
                        'b': np.random.randn(len(self.series))})

        result = df.values.squeeze()
        assert (result[:, 0] == expected.values).all()

        df = DataFrame({'a': self.series, 'b': ['foo'] * len(self.series)})

        result = df.values.squeeze()
        assert (result[:, 0] == expected.values).all()

    def test_comp_series_period_scalar(self):
        # GH 13200
        for freq in ['M', '2M', '3M']:
            base = Series([Period(x, freq=freq) for x in
                           ['2011-01', '2011-02', '2011-03', '2011-04']])
            p = Period('2011-02', freq=freq)

            exp = pd.Series([False, True, False, False])
            tm.assert_series_equal(base == p, exp)
            tm.assert_series_equal(p == base, exp)

            exp = pd.Series([True, False, True, True])
            tm.assert_series_equal(base != p, exp)
            tm.assert_series_equal(p != base, exp)

            exp = pd.Series([False, False, True, True])
            tm.assert_series_equal(base > p, exp)
            tm.assert_series_equal(p < base, exp)

            exp = pd.Series([True, False, False, False])
            tm.assert_series_equal(base < p, exp)
            tm.assert_series_equal(p > base, exp)

            exp = pd.Series([False, True, True, True])
            tm.assert_series_equal(base >= p, exp)
            tm.assert_series_equal(p <= base, exp)

            exp = pd.Series([True, True, False, False])
            tm.assert_series_equal(base <= p, exp)
            tm.assert_series_equal(p >= base, exp)

            # different base freq
            msg = "Input has different freq=A-DEC from Period"
            with tm.assert_raises_regex(
                    period.IncompatibleFrequency, msg):
                base <= Period('2011', freq='A')

            with tm.assert_raises_regex(
                    period.IncompatibleFrequency, msg):
                Period('2011', freq='A') >= base

    def test_comp_series_period_series(self):
        # GH 13200
        for freq in ['M', '2M', '3M']:
            base = Series([Period(x, freq=freq) for x in
                           ['2011-01', '2011-02', '2011-03', '2011-04']])

            s = Series([Period(x, freq=freq) for x in
                        ['2011-02', '2011-01', '2011-03', '2011-05']])

            exp = Series([False, False, True, False])
            tm.assert_series_equal(base == s, exp)

            exp = Series([True, True, False, True])
            tm.assert_series_equal(base != s, exp)

            exp = Series([False, True, False, False])
            tm.assert_series_equal(base > s, exp)

            exp = Series([True, False, False, True])
            tm.assert_series_equal(base < s, exp)

            exp = Series([False, True, True, False])
            tm.assert_series_equal(base >= s, exp)

            exp = Series([True, False, True, True])
            tm.assert_series_equal(base <= s, exp)

            s2 = Series([Period(x, freq='A') for x in
                         ['2011', '2011', '2011', '2011']])

            # different base freq
            msg = "Input has different freq=A-DEC from Period"
            with tm.assert_raises_regex(
                    period.IncompatibleFrequency, msg):
                base <= s2

    def test_comp_series_period_object(self):
        # GH 13200
        base = Series([Period('2011', freq='A'), Period('2011-02', freq='M'),
                       Period('2013', freq='A'), Period('2011-04', freq='M')])

        s = Series([Period('2012', freq='A'), Period('2011-01', freq='M'),
                    Period('2013', freq='A'), Period('2011-05', freq='M')])

        exp = Series([False, False, True, False])
        tm.assert_series_equal(base == s, exp)

        exp = Series([True, True, False, True])
        tm.assert_series_equal(base != s, exp)

        exp = Series([False, True, False, False])
        tm.assert_series_equal(base > s, exp)

        exp = Series([True, False, False, True])
        tm.assert_series_equal(base < s, exp)

        exp = Series([False, True, True, False])
        tm.assert_series_equal(base >= s, exp)

        exp = Series([True, False, True, True])
        tm.assert_series_equal(base <= s, exp)

    def test_align_series(self):
        rng = period_range('1/1/2000', '1/1/2010', freq='A')
        ts = Series(np.random.randn(len(rng)), index=rng)

        result = ts + ts[::2]
        expected = ts + ts
        expected[1::2] = np.nan
        tm.assert_series_equal(result, expected)

        result = ts + _permute(ts[::2])
        tm.assert_series_equal(result, expected)

        # it works!
        for kind in ['inner', 'outer', 'left', 'right']:
            ts.align(ts[::2], join=kind)
        msg = "Input has different freq=D from PeriodIndex\\(freq=A-DEC\\)"
        with tm.assert_raises_regex(period.IncompatibleFrequency, msg):
            ts + ts.asfreq('D', how="end")
