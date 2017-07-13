import pytest

import numpy as np
import pandas as pd
import pandas.util.testing as tm
import pandas.compat as compat
from pandas import notnull, Index, DatetimeIndex, datetime, date_range


class TestDatetimeIndex(object):

    def test_where_other(self):

        # other is ndarray or Index
        i = pd.date_range('20130101', periods=3, tz='US/Eastern')

        for arr in [np.nan, pd.NaT]:
            result = i.where(notnull(i), other=np.nan)
            expected = i
            tm.assert_index_equal(result, expected)

        i2 = i.copy()
        i2 = Index([pd.NaT, pd.NaT] + i[2:].tolist())
        result = i.where(notnull(i2), i2)
        tm.assert_index_equal(result, i2)

        i2 = i.copy()
        i2 = Index([pd.NaT, pd.NaT] + i[2:].tolist())
        result = i.where(notnull(i2), i2.values)
        tm.assert_index_equal(result, i2)

    def test_where_tz(self):
        i = pd.date_range('20130101', periods=3, tz='US/Eastern')
        result = i.where(notnull(i))
        expected = i
        tm.assert_index_equal(result, expected)

        i2 = i.copy()
        i2 = Index([pd.NaT, pd.NaT] + i[2:].tolist())
        result = i.where(notnull(i2))
        expected = i2
        tm.assert_index_equal(result, expected)

    def test_insert(self):
        idx = DatetimeIndex(
            ['2000-01-04', '2000-01-01', '2000-01-02'], name='idx')

        result = idx.insert(2, datetime(2000, 1, 5))
        exp = DatetimeIndex(['2000-01-04', '2000-01-01', '2000-01-05',
                             '2000-01-02'], name='idx')
        tm.assert_index_equal(result, exp)

        # insertion of non-datetime should coerce to object index
        result = idx.insert(1, 'inserted')
        expected = Index([datetime(2000, 1, 4), 'inserted',
                          datetime(2000, 1, 1),
                          datetime(2000, 1, 2)], name='idx')
        assert not isinstance(result, DatetimeIndex)
        tm.assert_index_equal(result, expected)
        assert result.name == expected.name

        idx = date_range('1/1/2000', periods=3, freq='M', name='idx')

        # preserve freq
        expected_0 = DatetimeIndex(['1999-12-31', '2000-01-31', '2000-02-29',
                                    '2000-03-31'], name='idx', freq='M')
        expected_3 = DatetimeIndex(['2000-01-31', '2000-02-29', '2000-03-31',
                                    '2000-04-30'], name='idx', freq='M')

        # reset freq to None
        expected_1_nofreq = DatetimeIndex(['2000-01-31', '2000-01-31',
                                           '2000-02-29',
                                           '2000-03-31'], name='idx',
                                          freq=None)
        expected_3_nofreq = DatetimeIndex(['2000-01-31', '2000-02-29',
                                           '2000-03-31',
                                           '2000-01-02'], name='idx',
                                          freq=None)

        cases = [(0, datetime(1999, 12, 31), expected_0),
                 (-3, datetime(1999, 12, 31), expected_0),
                 (3, datetime(2000, 4, 30), expected_3),
                 (1, datetime(2000, 1, 31), expected_1_nofreq),
                 (3, datetime(2000, 1, 2), expected_3_nofreq)]

        for n, d, expected in cases:
            result = idx.insert(n, d)
            tm.assert_index_equal(result, expected)
            assert result.name == expected.name
            assert result.freq == expected.freq

        # reset freq to None
        result = idx.insert(3, datetime(2000, 1, 2))
        expected = DatetimeIndex(['2000-01-31', '2000-02-29', '2000-03-31',
                                  '2000-01-02'], name='idx', freq=None)
        tm.assert_index_equal(result, expected)
        assert result.name == expected.name
        assert result.freq is None

        # GH 7299
        tm._skip_if_no_pytz()
        import pytz

        idx = date_range('1/1/2000', periods=3, freq='D', tz='Asia/Tokyo',
                         name='idx')
        with pytest.raises(ValueError):
            idx.insert(3, pd.Timestamp('2000-01-04'))
        with pytest.raises(ValueError):
            idx.insert(3, datetime(2000, 1, 4))
        with pytest.raises(ValueError):
            idx.insert(3, pd.Timestamp('2000-01-04', tz='US/Eastern'))
        with pytest.raises(ValueError):
            idx.insert(3, datetime(2000, 1, 4,
                                   tzinfo=pytz.timezone('US/Eastern')))

        for tz in ['US/Pacific', 'Asia/Singapore']:
            idx = date_range('1/1/2000 09:00', periods=6, freq='H', tz=tz,
                             name='idx')
            # preserve freq
            expected = date_range('1/1/2000 09:00', periods=7, freq='H', tz=tz,
                                  name='idx')
            for d in [pd.Timestamp('2000-01-01 15:00', tz=tz),
                      pytz.timezone(tz).localize(datetime(2000, 1, 1, 15))]:

                result = idx.insert(6, d)
                tm.assert_index_equal(result, expected)
                assert result.name == expected.name
                assert result.freq == expected.freq
                assert result.tz == expected.tz

            expected = DatetimeIndex(['2000-01-01 09:00', '2000-01-01 10:00',
                                      '2000-01-01 11:00',
                                      '2000-01-01 12:00', '2000-01-01 13:00',
                                      '2000-01-01 14:00',
                                      '2000-01-01 10:00'], name='idx',
                                     tz=tz, freq=None)
            # reset freq to None
            for d in [pd.Timestamp('2000-01-01 10:00', tz=tz),
                      pytz.timezone(tz).localize(datetime(2000, 1, 1, 10))]:
                result = idx.insert(6, d)
                tm.assert_index_equal(result, expected)
                assert result.name == expected.name
                assert result.tz == expected.tz
                assert result.freq is None

    def test_delete(self):
        idx = date_range(start='2000-01-01', periods=5, freq='M', name='idx')

        # prserve freq
        expected_0 = date_range(start='2000-02-01', periods=4, freq='M',
                                name='idx')
        expected_4 = date_range(start='2000-01-01', periods=4, freq='M',
                                name='idx')

        # reset freq to None
        expected_1 = DatetimeIndex(['2000-01-31', '2000-03-31', '2000-04-30',
                                    '2000-05-31'], freq=None, name='idx')

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

        for tz in [None, 'Asia/Tokyo', 'US/Pacific']:
            idx = date_range(start='2000-01-01 09:00', periods=10, freq='H',
                             name='idx', tz=tz)

            expected = date_range(start='2000-01-01 10:00', periods=9,
                                  freq='H', name='idx', tz=tz)
            result = idx.delete(0)
            tm.assert_index_equal(result, expected)
            assert result.name == expected.name
            assert result.freqstr == 'H'
            assert result.tz == expected.tz

            expected = date_range(start='2000-01-01 09:00', periods=9,
                                  freq='H', name='idx', tz=tz)
            result = idx.delete(-1)
            tm.assert_index_equal(result, expected)
            assert result.name == expected.name
            assert result.freqstr == 'H'
            assert result.tz == expected.tz

    def test_delete_slice(self):
        idx = date_range(start='2000-01-01', periods=10, freq='D', name='idx')

        # prserve freq
        expected_0_2 = date_range(start='2000-01-04', periods=7, freq='D',
                                  name='idx')
        expected_7_9 = date_range(start='2000-01-01', periods=7, freq='D',
                                  name='idx')

        # reset freq to None
        expected_3_5 = DatetimeIndex(['2000-01-01', '2000-01-02', '2000-01-03',
                                      '2000-01-07', '2000-01-08', '2000-01-09',
                                      '2000-01-10'], freq=None, name='idx')

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

        for tz in [None, 'Asia/Tokyo', 'US/Pacific']:
            ts = pd.Series(1, index=pd.date_range(
                '2000-01-01 09:00', periods=10, freq='H', name='idx', tz=tz))
            # preserve freq
            result = ts.drop(ts.index[:5]).index
            expected = pd.date_range('2000-01-01 14:00', periods=5, freq='H',
                                     name='idx', tz=tz)
            tm.assert_index_equal(result, expected)
            assert result.name == expected.name
            assert result.freq == expected.freq
            assert result.tz == expected.tz

            # reset freq to None
            result = ts.drop(ts.index[[1, 3, 5, 7, 9]]).index
            expected = DatetimeIndex(['2000-01-01 09:00', '2000-01-01 11:00',
                                      '2000-01-01 13:00',
                                      '2000-01-01 15:00', '2000-01-01 17:00'],
                                     freq=None, name='idx', tz=tz)
            tm.assert_index_equal(result, expected)
            assert result.name == expected.name
            assert result.freq == expected.freq
            assert result.tz == expected.tz
