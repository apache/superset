from datetime import datetime

import pytest

import numpy as np
import pandas as pd
from pandas.util import testing as tm
from pandas.compat import lrange
from pandas._libs import tslib
from pandas import (PeriodIndex, Series, DatetimeIndex,
                    period_range, Period, _np_version_under1p9)


class TestGetItem(object):

    def setup_method(self, method):
        pass

    def test_getitem(self):
        idx1 = pd.period_range('2011-01-01', '2011-01-31', freq='D',
                               name='idx')

        for idx in [idx1]:
            result = idx[0]
            assert result == pd.Period('2011-01-01', freq='D')

            result = idx[-1]
            assert result == pd.Period('2011-01-31', freq='D')

            result = idx[0:5]
            expected = pd.period_range('2011-01-01', '2011-01-05', freq='D',
                                       name='idx')
            tm.assert_index_equal(result, expected)
            assert result.freq == expected.freq
            assert result.freq == 'D'

            result = idx[0:10:2]
            expected = pd.PeriodIndex(['2011-01-01', '2011-01-03',
                                       '2011-01-05',
                                       '2011-01-07', '2011-01-09'],
                                      freq='D', name='idx')
            tm.assert_index_equal(result, expected)
            assert result.freq == expected.freq
            assert result.freq == 'D'

            result = idx[-20:-5:3]
            expected = pd.PeriodIndex(['2011-01-12', '2011-01-15',
                                       '2011-01-18',
                                       '2011-01-21', '2011-01-24'],
                                      freq='D', name='idx')
            tm.assert_index_equal(result, expected)
            assert result.freq == expected.freq
            assert result.freq == 'D'

            result = idx[4::-1]
            expected = PeriodIndex(['2011-01-05', '2011-01-04', '2011-01-03',
                                    '2011-01-02', '2011-01-01'],
                                   freq='D', name='idx')
            tm.assert_index_equal(result, expected)
            assert result.freq == expected.freq
            assert result.freq == 'D'

    def test_getitem_index(self):
        idx = period_range('2007-01', periods=10, freq='M', name='x')

        result = idx[[1, 3, 5]]
        exp = pd.PeriodIndex(['2007-02', '2007-04', '2007-06'],
                             freq='M', name='x')
        tm.assert_index_equal(result, exp)

        result = idx[[True, True, False, False, False,
                      True, True, False, False, False]]
        exp = pd.PeriodIndex(['2007-01', '2007-02', '2007-06', '2007-07'],
                             freq='M', name='x')
        tm.assert_index_equal(result, exp)

    def test_getitem_partial(self):
        rng = period_range('2007-01', periods=50, freq='M')
        ts = Series(np.random.randn(len(rng)), rng)

        pytest.raises(KeyError, ts.__getitem__, '2006')

        result = ts['2008']
        assert (result.index.year == 2008).all()

        result = ts['2008':'2009']
        assert len(result) == 24

        result = ts['2008-1':'2009-12']
        assert len(result) == 24

        result = ts['2008Q1':'2009Q4']
        assert len(result) == 24

        result = ts[:'2009']
        assert len(result) == 36

        result = ts['2009':]
        assert len(result) == 50 - 24

        exp = result
        result = ts[24:]
        tm.assert_series_equal(exp, result)

        ts = ts[10:].append(ts[10:])
        tm.assert_raises_regex(KeyError,
                               "left slice bound for non-unique "
                               "label: '2008'",
                               ts.__getitem__, slice('2008', '2009'))

    def test_getitem_datetime(self):
        rng = period_range(start='2012-01-01', periods=10, freq='W-MON')
        ts = Series(lrange(len(rng)), index=rng)

        dt1 = datetime(2011, 10, 2)
        dt4 = datetime(2012, 4, 20)

        rs = ts[dt1:dt4]
        tm.assert_series_equal(rs, ts)

    def test_getitem_nat(self):
        idx = pd.PeriodIndex(['2011-01', 'NaT', '2011-02'], freq='M')
        assert idx[0] == pd.Period('2011-01', freq='M')
        assert idx[1] is tslib.NaT

        s = pd.Series([0, 1, 2], index=idx)
        assert s[pd.NaT] == 1

        s = pd.Series(idx, index=idx)
        assert (s[pd.Period('2011-01', freq='M')] ==
                pd.Period('2011-01', freq='M'))
        assert s[pd.NaT] is tslib.NaT

    def test_getitem_list_periods(self):
        # GH 7710
        rng = period_range(start='2012-01-01', periods=10, freq='D')
        ts = Series(lrange(len(rng)), index=rng)
        exp = ts.iloc[[1]]
        tm.assert_series_equal(ts[[Period('2012-01-02', freq='D')]], exp)

    def test_getitem_seconds(self):
        # GH 6716
        didx = DatetimeIndex(start='2013/01/01 09:00:00', freq='S',
                             periods=4000)
        pidx = PeriodIndex(start='2013/01/01 09:00:00', freq='S', periods=4000)

        for idx in [didx, pidx]:
            # getitem against index should raise ValueError
            values = ['2014', '2013/02', '2013/01/02', '2013/02/01 9H',
                      '2013/02/01 09:00']
            for v in values:
                if _np_version_under1p9:
                    with pytest.raises(ValueError):
                        idx[v]
                else:
                    # GH7116
                    # these show deprecations as we are trying
                    # to slice with non-integer indexers
                    # with pytest.raises(IndexError):
                    #    idx[v]
                    continue

            s = Series(np.random.rand(len(idx)), index=idx)
            tm.assert_series_equal(s['2013/01/01 10:00'], s[3600:3660])
            tm.assert_series_equal(s['2013/01/01 9H'], s[:3600])
            for d in ['2013/01/01', '2013/01', '2013']:
                tm.assert_series_equal(s[d], s)

    def test_getitem_day(self):
        # GH 6716
        # Confirm DatetimeIndex and PeriodIndex works identically
        didx = DatetimeIndex(start='2013/01/01', freq='D', periods=400)
        pidx = PeriodIndex(start='2013/01/01', freq='D', periods=400)

        for idx in [didx, pidx]:
            # getitem against index should raise ValueError
            values = ['2014', '2013/02', '2013/01/02', '2013/02/01 9H',
                      '2013/02/01 09:00']
            for v in values:

                if _np_version_under1p9:
                    with pytest.raises(ValueError):
                        idx[v]
                else:
                    # GH7116
                    # these show deprecations as we are trying
                    # to slice with non-integer indexers
                    # with pytest.raises(IndexError):
                    #    idx[v]
                    continue

            s = Series(np.random.rand(len(idx)), index=idx)
            tm.assert_series_equal(s['2013/01'], s[0:31])
            tm.assert_series_equal(s['2013/02'], s[31:59])
            tm.assert_series_equal(s['2014'], s[365:])

            invalid = ['2013/02/01 9H', '2013/02/01 09:00']
            for v in invalid:
                with pytest.raises(KeyError):
                    s[v]


class TestIndexing(object):

    def test_get_loc_msg(self):
        idx = period_range('2000-1-1', freq='A', periods=10)
        bad_period = Period('2012', 'A')
        pytest.raises(KeyError, idx.get_loc, bad_period)

        try:
            idx.get_loc(bad_period)
        except KeyError as inst:
            assert inst.args[0] == bad_period

    def test_get_loc_nat(self):
        didx = DatetimeIndex(['2011-01-01', 'NaT', '2011-01-03'])
        pidx = PeriodIndex(['2011-01-01', 'NaT', '2011-01-03'], freq='M')

        # check DatetimeIndex compat
        for idx in [didx, pidx]:
            assert idx.get_loc(pd.NaT) == 1
            assert idx.get_loc(None) == 1
            assert idx.get_loc(float('nan')) == 1
            assert idx.get_loc(np.nan) == 1

    def test_take(self):
        # GH 10295
        idx1 = pd.period_range('2011-01-01', '2011-01-31', freq='D',
                               name='idx')

        for idx in [idx1]:
            result = idx.take([0])
            assert result == pd.Period('2011-01-01', freq='D')

            result = idx.take([5])
            assert result == pd.Period('2011-01-06', freq='D')

            result = idx.take([0, 1, 2])
            expected = pd.period_range('2011-01-01', '2011-01-03', freq='D',
                                       name='idx')
            tm.assert_index_equal(result, expected)
            assert result.freq == 'D'
            assert result.freq == expected.freq

            result = idx.take([0, 2, 4])
            expected = pd.PeriodIndex(['2011-01-01', '2011-01-03',
                                       '2011-01-05'], freq='D', name='idx')
            tm.assert_index_equal(result, expected)
            assert result.freq == expected.freq
            assert result.freq == 'D'

            result = idx.take([7, 4, 1])
            expected = pd.PeriodIndex(['2011-01-08', '2011-01-05',
                                       '2011-01-02'],
                                      freq='D', name='idx')
            tm.assert_index_equal(result, expected)
            assert result.freq == expected.freq
            assert result.freq == 'D'

            result = idx.take([3, 2, 5])
            expected = PeriodIndex(['2011-01-04', '2011-01-03', '2011-01-06'],
                                   freq='D', name='idx')
            tm.assert_index_equal(result, expected)
            assert result.freq == expected.freq
            assert result.freq == 'D'

            result = idx.take([-3, 2, 5])
            expected = PeriodIndex(['2011-01-29', '2011-01-03', '2011-01-06'],
                                   freq='D', name='idx')
            tm.assert_index_equal(result, expected)
            assert result.freq == expected.freq
            assert result.freq == 'D'

    def test_take_misc(self):
        index = PeriodIndex(start='1/1/10', end='12/31/12', freq='D',
                            name='idx')
        expected = PeriodIndex([datetime(2010, 1, 6), datetime(2010, 1, 7),
                                datetime(2010, 1, 9), datetime(2010, 1, 13)],
                               freq='D', name='idx')

        taken1 = index.take([5, 6, 8, 12])
        taken2 = index[[5, 6, 8, 12]]

        for taken in [taken1, taken2]:
            tm.assert_index_equal(taken, expected)
            assert isinstance(taken, PeriodIndex)
            assert taken.freq == index.freq
            assert taken.name == expected.name

    def test_take_fill_value(self):
        # GH 12631
        idx = pd.PeriodIndex(['2011-01-01', '2011-02-01', '2011-03-01'],
                             name='xxx', freq='D')
        result = idx.take(np.array([1, 0, -1]))
        expected = pd.PeriodIndex(['2011-02-01', '2011-01-01', '2011-03-01'],
                                  name='xxx', freq='D')
        tm.assert_index_equal(result, expected)

        # fill_value
        result = idx.take(np.array([1, 0, -1]), fill_value=True)
        expected = pd.PeriodIndex(['2011-02-01', '2011-01-01', 'NaT'],
                                  name='xxx', freq='D')
        tm.assert_index_equal(result, expected)

        # allow_fill=False
        result = idx.take(np.array([1, 0, -1]), allow_fill=False,
                          fill_value=True)
        expected = pd.PeriodIndex(['2011-02-01', '2011-01-01', '2011-03-01'],
                                  name='xxx', freq='D')
        tm.assert_index_equal(result, expected)

        msg = ('When allow_fill=True and fill_value is not None, '
               'all indices must be >= -1')
        with tm.assert_raises_regex(ValueError, msg):
            idx.take(np.array([1, 0, -2]), fill_value=True)
        with tm.assert_raises_regex(ValueError, msg):
            idx.take(np.array([1, 0, -5]), fill_value=True)

        with pytest.raises(IndexError):
            idx.take(np.array([1, -5]))
