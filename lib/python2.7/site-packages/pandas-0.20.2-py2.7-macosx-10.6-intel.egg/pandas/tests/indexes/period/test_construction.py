import pytest

import numpy as np
import pandas as pd
import pandas.util.testing as tm
import pandas.core.indexes.period as period
from pandas.compat import lrange, PY3, text_type, lmap
from pandas import (Period, PeriodIndex, period_range, offsets, date_range,
                    Series, Index)


class TestPeriodIndex(object):

    def setup_method(self, method):
        pass

    def test_construction_base_constructor(self):
        # GH 13664
        arr = [pd.Period('2011-01', freq='M'), pd.NaT,
               pd.Period('2011-03', freq='M')]
        tm.assert_index_equal(pd.Index(arr), pd.PeriodIndex(arr))
        tm.assert_index_equal(pd.Index(np.array(arr)),
                              pd.PeriodIndex(np.array(arr)))

        arr = [np.nan, pd.NaT, pd.Period('2011-03', freq='M')]
        tm.assert_index_equal(pd.Index(arr), pd.PeriodIndex(arr))
        tm.assert_index_equal(pd.Index(np.array(arr)),
                              pd.PeriodIndex(np.array(arr)))

        arr = [pd.Period('2011-01', freq='M'), pd.NaT,
               pd.Period('2011-03', freq='D')]
        tm.assert_index_equal(pd.Index(arr), pd.Index(arr, dtype=object))

        tm.assert_index_equal(pd.Index(np.array(arr)),
                              pd.Index(np.array(arr), dtype=object))

    def test_constructor_use_start_freq(self):
        # GH #1118
        p = Period('4/2/2012', freq='B')
        index = PeriodIndex(start=p, periods=10)
        expected = PeriodIndex(start='4/2/2012', periods=10, freq='B')
        tm.assert_index_equal(index, expected)

    def test_constructor_field_arrays(self):
        # GH #1264

        years = np.arange(1990, 2010).repeat(4)[2:-2]
        quarters = np.tile(np.arange(1, 5), 20)[2:-2]

        index = PeriodIndex(year=years, quarter=quarters, freq='Q-DEC')
        expected = period_range('1990Q3', '2009Q2', freq='Q-DEC')
        tm.assert_index_equal(index, expected)

        index2 = PeriodIndex(year=years, quarter=quarters, freq='2Q-DEC')
        tm.assert_numpy_array_equal(index.asi8, index2.asi8)

        index = PeriodIndex(year=years, quarter=quarters)
        tm.assert_index_equal(index, expected)

        years = [2007, 2007, 2007]
        months = [1, 2]
        pytest.raises(ValueError, PeriodIndex, year=years, month=months,
                      freq='M')
        pytest.raises(ValueError, PeriodIndex, year=years, month=months,
                      freq='2M')
        pytest.raises(ValueError, PeriodIndex, year=years, month=months,
                      freq='M', start=Period('2007-01', freq='M'))

        years = [2007, 2007, 2007]
        months = [1, 2, 3]
        idx = PeriodIndex(year=years, month=months, freq='M')
        exp = period_range('2007-01', periods=3, freq='M')
        tm.assert_index_equal(idx, exp)

    def test_constructor_U(self):
        # U was used as undefined period
        pytest.raises(ValueError, period_range, '2007-1-1', periods=500,
                      freq='X')

    def test_constructor_nano(self):
        idx = period_range(start=Period(ordinal=1, freq='N'),
                           end=Period(ordinal=4, freq='N'), freq='N')
        exp = PeriodIndex([Period(ordinal=1, freq='N'),
                           Period(ordinal=2, freq='N'),
                           Period(ordinal=3, freq='N'),
                           Period(ordinal=4, freq='N')], freq='N')
        tm.assert_index_equal(idx, exp)

    def test_constructor_arrays_negative_year(self):
        years = np.arange(1960, 2000, dtype=np.int64).repeat(4)
        quarters = np.tile(np.array([1, 2, 3, 4], dtype=np.int64), 40)

        pindex = PeriodIndex(year=years, quarter=quarters)

        tm.assert_index_equal(pindex.year, pd.Index(years))
        tm.assert_index_equal(pindex.quarter, pd.Index(quarters))

    def test_constructor_invalid_quarters(self):
        pytest.raises(ValueError, PeriodIndex, year=lrange(2000, 2004),
                      quarter=lrange(4), freq='Q-DEC')

    def test_constructor_corner(self):
        pytest.raises(ValueError, PeriodIndex, periods=10, freq='A')

        start = Period('2007', freq='A-JUN')
        end = Period('2010', freq='A-DEC')
        pytest.raises(ValueError, PeriodIndex, start=start, end=end)
        pytest.raises(ValueError, PeriodIndex, start=start)
        pytest.raises(ValueError, PeriodIndex, end=end)

        result = period_range('2007-01', periods=10.5, freq='M')
        exp = period_range('2007-01', periods=10, freq='M')
        tm.assert_index_equal(result, exp)

    def test_constructor_fromarraylike(self):
        idx = period_range('2007-01', periods=20, freq='M')

        # values is an array of Period, thus can retrieve freq
        tm.assert_index_equal(PeriodIndex(idx.values), idx)
        tm.assert_index_equal(PeriodIndex(list(idx.values)), idx)

        pytest.raises(ValueError, PeriodIndex, idx._values)
        pytest.raises(ValueError, PeriodIndex, list(idx._values))
        pytest.raises(TypeError, PeriodIndex,
                      data=Period('2007', freq='A'))

        result = PeriodIndex(iter(idx))
        tm.assert_index_equal(result, idx)

        result = PeriodIndex(idx)
        tm.assert_index_equal(result, idx)

        result = PeriodIndex(idx, freq='M')
        tm.assert_index_equal(result, idx)

        result = PeriodIndex(idx, freq=offsets.MonthEnd())
        tm.assert_index_equal(result, idx)
        assert result.freq, 'M'

        result = PeriodIndex(idx, freq='2M')
        tm.assert_index_equal(result, idx.asfreq('2M'))
        assert result.freq, '2M'

        result = PeriodIndex(idx, freq=offsets.MonthEnd(2))
        tm.assert_index_equal(result, idx.asfreq('2M'))
        assert result.freq, '2M'

        result = PeriodIndex(idx, freq='D')
        exp = idx.asfreq('D', 'e')
        tm.assert_index_equal(result, exp)

    def test_constructor_datetime64arr(self):
        vals = np.arange(100000, 100000 + 10000, 100, dtype=np.int64)
        vals = vals.view(np.dtype('M8[us]'))

        pytest.raises(ValueError, PeriodIndex, vals, freq='D')

    def test_constructor_dtype(self):
        # passing a dtype with a tz should localize
        idx = PeriodIndex(['2013-01', '2013-03'], dtype='period[M]')
        exp = PeriodIndex(['2013-01', '2013-03'], freq='M')
        tm.assert_index_equal(idx, exp)
        assert idx.dtype == 'period[M]'

        idx = PeriodIndex(['2013-01-05', '2013-03-05'], dtype='period[3D]')
        exp = PeriodIndex(['2013-01-05', '2013-03-05'], freq='3D')
        tm.assert_index_equal(idx, exp)
        assert idx.dtype == 'period[3D]'

        # if we already have a freq and its not the same, then asfreq
        # (not changed)
        idx = PeriodIndex(['2013-01-01', '2013-01-02'], freq='D')

        res = PeriodIndex(idx, dtype='period[M]')
        exp = PeriodIndex(['2013-01', '2013-01'], freq='M')
        tm.assert_index_equal(res, exp)
        assert res.dtype == 'period[M]'

        res = PeriodIndex(idx, freq='M')
        tm.assert_index_equal(res, exp)
        assert res.dtype == 'period[M]'

        msg = 'specified freq and dtype are different'
        with tm.assert_raises_regex(period.IncompatibleFrequency, msg):
            PeriodIndex(['2011-01'], freq='M', dtype='period[D]')

    def test_constructor_empty(self):
        idx = pd.PeriodIndex([], freq='M')
        assert isinstance(idx, PeriodIndex)
        assert len(idx) == 0
        assert idx.freq == 'M'

        with tm.assert_raises_regex(ValueError, 'freq not specified'):
            pd.PeriodIndex([])

    def test_constructor_pi_nat(self):
        idx = PeriodIndex([Period('2011-01', freq='M'), pd.NaT,
                           Period('2011-01', freq='M')])
        exp = PeriodIndex(['2011-01', 'NaT', '2011-01'], freq='M')
        tm.assert_index_equal(idx, exp)

        idx = PeriodIndex(np.array([Period('2011-01', freq='M'), pd.NaT,
                                    Period('2011-01', freq='M')]))
        tm.assert_index_equal(idx, exp)

        idx = PeriodIndex([pd.NaT, pd.NaT, Period('2011-01', freq='M'),
                           Period('2011-01', freq='M')])
        exp = PeriodIndex(['NaT', 'NaT', '2011-01', '2011-01'], freq='M')
        tm.assert_index_equal(idx, exp)

        idx = PeriodIndex(np.array([pd.NaT, pd.NaT,
                                    Period('2011-01', freq='M'),
                                    Period('2011-01', freq='M')]))
        tm.assert_index_equal(idx, exp)

        idx = PeriodIndex([pd.NaT, pd.NaT, '2011-01', '2011-01'], freq='M')
        tm.assert_index_equal(idx, exp)

        with tm.assert_raises_regex(ValueError, 'freq not specified'):
            PeriodIndex([pd.NaT, pd.NaT])

        with tm.assert_raises_regex(ValueError, 'freq not specified'):
            PeriodIndex(np.array([pd.NaT, pd.NaT]))

        with tm.assert_raises_regex(ValueError, 'freq not specified'):
            PeriodIndex(['NaT', 'NaT'])

        with tm.assert_raises_regex(ValueError, 'freq not specified'):
            PeriodIndex(np.array(['NaT', 'NaT']))

    def test_constructor_incompat_freq(self):
        msg = "Input has different freq=D from PeriodIndex\\(freq=M\\)"

        with tm.assert_raises_regex(period.IncompatibleFrequency, msg):
            PeriodIndex([Period('2011-01', freq='M'), pd.NaT,
                         Period('2011-01', freq='D')])

        with tm.assert_raises_regex(period.IncompatibleFrequency, msg):
            PeriodIndex(np.array([Period('2011-01', freq='M'), pd.NaT,
                                  Period('2011-01', freq='D')]))

        # first element is pd.NaT
        with tm.assert_raises_regex(period.IncompatibleFrequency, msg):
            PeriodIndex([pd.NaT, Period('2011-01', freq='M'),
                         Period('2011-01', freq='D')])

        with tm.assert_raises_regex(period.IncompatibleFrequency, msg):
            PeriodIndex(np.array([pd.NaT, Period('2011-01', freq='M'),
                                  Period('2011-01', freq='D')]))

    def test_constructor_mixed(self):
        idx = PeriodIndex(['2011-01', pd.NaT, Period('2011-01', freq='M')])
        exp = PeriodIndex(['2011-01', 'NaT', '2011-01'], freq='M')
        tm.assert_index_equal(idx, exp)

        idx = PeriodIndex(['NaT', pd.NaT, Period('2011-01', freq='M')])
        exp = PeriodIndex(['NaT', 'NaT', '2011-01'], freq='M')
        tm.assert_index_equal(idx, exp)

        idx = PeriodIndex([Period('2011-01-01', freq='D'), pd.NaT,
                           '2012-01-01'])
        exp = PeriodIndex(['2011-01-01', 'NaT', '2012-01-01'], freq='D')
        tm.assert_index_equal(idx, exp)

    def test_constructor_simple_new(self):
        idx = period_range('2007-01', name='p', periods=2, freq='M')
        result = idx._simple_new(idx, 'p', freq=idx.freq)
        tm.assert_index_equal(result, idx)

        result = idx._simple_new(idx.astype('i8'), 'p', freq=idx.freq)
        tm.assert_index_equal(result, idx)

        result = idx._simple_new([pd.Period('2007-01', freq='M'),
                                  pd.Period('2007-02', freq='M')],
                                 'p', freq=idx.freq)
        tm.assert_index_equal(result, idx)

        result = idx._simple_new(np.array([pd.Period('2007-01', freq='M'),
                                           pd.Period('2007-02', freq='M')]),
                                 'p', freq=idx.freq)
        tm.assert_index_equal(result, idx)

    def test_constructor_simple_new_empty(self):
        # GH13079
        idx = PeriodIndex([], freq='M', name='p')
        result = idx._simple_new(idx, name='p', freq='M')
        tm.assert_index_equal(result, idx)

    def test_constructor_floats(self):
        # GH13079
        for floats in [[1.1, 2.1], np.array([1.1, 2.1])]:
            with pytest.raises(TypeError):
                pd.PeriodIndex._simple_new(floats, freq='M')

            with pytest.raises(TypeError):
                pd.PeriodIndex(floats, freq='M')

    def test_constructor_nat(self):
        pytest.raises(ValueError, period_range, start='NaT',
                      end='2011-01-01', freq='M')
        pytest.raises(ValueError, period_range, start='2011-01-01',
                      end='NaT', freq='M')

    def test_constructor_year_and_quarter(self):
        year = pd.Series([2001, 2002, 2003])
        quarter = year - 2000
        idx = PeriodIndex(year=year, quarter=quarter)
        strs = ['%dQ%d' % t for t in zip(quarter, year)]
        lops = list(map(Period, strs))
        p = PeriodIndex(lops)
        tm.assert_index_equal(p, idx)

    def test_constructor_freq_mult(self):
        # GH #7811
        for func in [PeriodIndex, period_range]:
            # must be the same, but for sure...
            pidx = func(start='2014-01', freq='2M', periods=4)
            expected = PeriodIndex(['2014-01', '2014-03',
                                    '2014-05', '2014-07'], freq='2M')
            tm.assert_index_equal(pidx, expected)

            pidx = func(start='2014-01-02', end='2014-01-15', freq='3D')
            expected = PeriodIndex(['2014-01-02', '2014-01-05',
                                    '2014-01-08', '2014-01-11',
                                    '2014-01-14'], freq='3D')
            tm.assert_index_equal(pidx, expected)

            pidx = func(end='2014-01-01 17:00', freq='4H', periods=3)
            expected = PeriodIndex(['2014-01-01 09:00', '2014-01-01 13:00',
                                    '2014-01-01 17:00'], freq='4H')
            tm.assert_index_equal(pidx, expected)

        msg = ('Frequency must be positive, because it'
               ' represents span: -1M')
        with tm.assert_raises_regex(ValueError, msg):
            PeriodIndex(['2011-01'], freq='-1M')

        msg = ('Frequency must be positive, because it' ' represents span: 0M')
        with tm.assert_raises_regex(ValueError, msg):
            PeriodIndex(['2011-01'], freq='0M')

        msg = ('Frequency must be positive, because it' ' represents span: 0M')
        with tm.assert_raises_regex(ValueError, msg):
            period_range('2011-01', periods=3, freq='0M')

    def test_constructor_freq_mult_dti_compat(self):
        import itertools
        mults = [1, 2, 3, 4, 5]
        freqs = ['A', 'M', 'D', 'T', 'S']
        for mult, freq in itertools.product(mults, freqs):
            freqstr = str(mult) + freq
            pidx = PeriodIndex(start='2014-04-01', freq=freqstr, periods=10)
            expected = date_range(start='2014-04-01', freq=freqstr,
                                  periods=10).to_period(freqstr)
            tm.assert_index_equal(pidx, expected)

    def test_constructor_freq_combined(self):
        for freq in ['1D1H', '1H1D']:
            pidx = PeriodIndex(['2016-01-01', '2016-01-02'], freq=freq)
            expected = PeriodIndex(['2016-01-01 00:00', '2016-01-02 00:00'],
                                   freq='25H')
        for freq, func in zip(['1D1H', '1H1D'], [PeriodIndex, period_range]):
            pidx = func(start='2016-01-01', periods=2, freq=freq)
            expected = PeriodIndex(['2016-01-01 00:00', '2016-01-02 01:00'],
                                   freq='25H')
            tm.assert_index_equal(pidx, expected)

    def test_constructor(self):
        pi = PeriodIndex(freq='A', start='1/1/2001', end='12/1/2009')
        assert len(pi) == 9

        pi = PeriodIndex(freq='Q', start='1/1/2001', end='12/1/2009')
        assert len(pi) == 4 * 9

        pi = PeriodIndex(freq='M', start='1/1/2001', end='12/1/2009')
        assert len(pi) == 12 * 9

        pi = PeriodIndex(freq='D', start='1/1/2001', end='12/31/2009')
        assert len(pi) == 365 * 9 + 2

        pi = PeriodIndex(freq='B', start='1/1/2001', end='12/31/2009')
        assert len(pi) == 261 * 9

        pi = PeriodIndex(freq='H', start='1/1/2001', end='12/31/2001 23:00')
        assert len(pi) == 365 * 24

        pi = PeriodIndex(freq='Min', start='1/1/2001', end='1/1/2001 23:59')
        assert len(pi) == 24 * 60

        pi = PeriodIndex(freq='S', start='1/1/2001', end='1/1/2001 23:59:59')
        assert len(pi) == 24 * 60 * 60

        start = Period('02-Apr-2005', 'B')
        i1 = PeriodIndex(start=start, periods=20)
        assert len(i1) == 20
        assert i1.freq == start.freq
        assert i1[0] == start

        end_intv = Period('2006-12-31', 'W')
        i1 = PeriodIndex(end=end_intv, periods=10)
        assert len(i1) == 10
        assert i1.freq == end_intv.freq
        assert i1[-1] == end_intv

        end_intv = Period('2006-12-31', '1w')
        i2 = PeriodIndex(end=end_intv, periods=10)
        assert len(i1) == len(i2)
        assert (i1 == i2).all()
        assert i1.freq == i2.freq

        end_intv = Period('2006-12-31', ('w', 1))
        i2 = PeriodIndex(end=end_intv, periods=10)
        assert len(i1) == len(i2)
        assert (i1 == i2).all()
        assert i1.freq == i2.freq

        end_intv = Period('2005-05-01', 'B')
        i1 = PeriodIndex(start=start, end=end_intv)

        # infer freq from first element
        i2 = PeriodIndex([end_intv, Period('2005-05-05', 'B')])
        assert len(i2) == 2
        assert i2[0] == end_intv

        i2 = PeriodIndex(np.array([end_intv, Period('2005-05-05', 'B')]))
        assert len(i2) == 2
        assert i2[0] == end_intv

        # Mixed freq should fail
        vals = [end_intv, Period('2006-12-31', 'w')]
        pytest.raises(ValueError, PeriodIndex, vals)
        vals = np.array(vals)
        pytest.raises(ValueError, PeriodIndex, vals)

    def test_constructor_error(self):
        start = Period('02-Apr-2005', 'B')
        end_intv = Period('2006-12-31', ('w', 1))

        msg = 'Start and end must have same freq'
        with tm.assert_raises_regex(ValueError, msg):
            PeriodIndex(start=start, end=end_intv)

        msg = 'Must specify 2 of start, end, periods'
        with tm.assert_raises_regex(ValueError, msg):
            PeriodIndex(start=start)

    def test_recreate_from_data(self):
        for o in ['M', 'Q', 'A', 'D', 'B', 'T', 'S', 'L', 'U', 'N', 'H']:
            org = PeriodIndex(start='2001/04/01', freq=o, periods=1)
            idx = PeriodIndex(org.values, freq=o)
            tm.assert_index_equal(idx, org)

    def test_map_with_string_constructor(self):
        raw = [2005, 2007, 2009]
        index = PeriodIndex(raw, freq='A')
        types = str,

        if PY3:
            # unicode
            types += text_type,

        for t in types:
            expected = Index(lmap(t, raw))
            res = index.map(t)

            # should return an Index
            assert isinstance(res, Index)

            # preserve element types
            assert all(isinstance(resi, t) for resi in res)

            # lastly, values should compare equal
            tm.assert_index_equal(res, expected)


class TestSeriesPeriod(object):

    def setup_method(self, method):
        self.series = Series(period_range('2000-01-01', periods=10, freq='D'))

    def test_constructor_cant_cast_period(self):
        with pytest.raises(TypeError):
            Series(period_range('2000-01-01', periods=10, freq='D'),
                   dtype=float)

    def test_constructor_cast_object(self):
        s = Series(period_range('1/1/2000', periods=10), dtype=object)
        exp = Series(period_range('1/1/2000', periods=10))
        tm.assert_series_equal(s, exp)
