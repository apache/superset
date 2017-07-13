import pytest

import numpy as np
import pandas as pd
import pandas.util.testing as tm
from pandas import (Index, DatetimeIndex, datetime, offsets,
                    Float64Index, date_range, Timestamp)


class TestDateTimeIndexToJulianDate(object):

    def test_1700(self):
        r1 = Float64Index([2345897.5, 2345898.5, 2345899.5, 2345900.5,
                           2345901.5])
        r2 = date_range(start=Timestamp('1710-10-01'), periods=5,
                        freq='D').to_julian_date()
        assert isinstance(r2, Float64Index)
        tm.assert_index_equal(r1, r2)

    def test_2000(self):
        r1 = Float64Index([2451601.5, 2451602.5, 2451603.5, 2451604.5,
                           2451605.5])
        r2 = date_range(start=Timestamp('2000-02-27'), periods=5,
                        freq='D').to_julian_date()
        assert isinstance(r2, Float64Index)
        tm.assert_index_equal(r1, r2)

    def test_hour(self):
        r1 = Float64Index(
            [2451601.5, 2451601.5416666666666666, 2451601.5833333333333333,
             2451601.625, 2451601.6666666666666666])
        r2 = date_range(start=Timestamp('2000-02-27'), periods=5,
                        freq='H').to_julian_date()
        assert isinstance(r2, Float64Index)
        tm.assert_index_equal(r1, r2)

    def test_minute(self):
        r1 = Float64Index(
            [2451601.5, 2451601.5006944444444444, 2451601.5013888888888888,
             2451601.5020833333333333, 2451601.5027777777777777])
        r2 = date_range(start=Timestamp('2000-02-27'), periods=5,
                        freq='T').to_julian_date()
        assert isinstance(r2, Float64Index)
        tm.assert_index_equal(r1, r2)

    def test_second(self):
        r1 = Float64Index(
            [2451601.5, 2451601.500011574074074, 2451601.5000231481481481,
             2451601.5000347222222222, 2451601.5000462962962962])
        r2 = date_range(start=Timestamp('2000-02-27'), periods=5,
                        freq='S').to_julian_date()
        assert isinstance(r2, Float64Index)
        tm.assert_index_equal(r1, r2)


class TestTimeSeries(object):

    def test_pass_datetimeindex_to_index(self):
        # Bugs in #1396
        rng = date_range('1/1/2000', '3/1/2000')
        idx = Index(rng, dtype=object)

        expected = Index(rng.to_pydatetime(), dtype=object)

        tm.assert_numpy_array_equal(idx.values, expected.values)

    def test_range_edges(self):
        # GH 13672
        idx = DatetimeIndex(start=Timestamp('1970-01-01 00:00:00.000000001'),
                            end=Timestamp('1970-01-01 00:00:00.000000004'),
                            freq='N')
        exp = DatetimeIndex(['1970-01-01 00:00:00.000000001',
                             '1970-01-01 00:00:00.000000002',
                             '1970-01-01 00:00:00.000000003',
                             '1970-01-01 00:00:00.000000004'])
        tm.assert_index_equal(idx, exp)

        idx = DatetimeIndex(start=Timestamp('1970-01-01 00:00:00.000000004'),
                            end=Timestamp('1970-01-01 00:00:00.000000001'),
                            freq='N')
        exp = DatetimeIndex([])
        tm.assert_index_equal(idx, exp)

        idx = DatetimeIndex(start=Timestamp('1970-01-01 00:00:00.000000001'),
                            end=Timestamp('1970-01-01 00:00:00.000000001'),
                            freq='N')
        exp = DatetimeIndex(['1970-01-01 00:00:00.000000001'])
        tm.assert_index_equal(idx, exp)

        idx = DatetimeIndex(start=Timestamp('1970-01-01 00:00:00.000001'),
                            end=Timestamp('1970-01-01 00:00:00.000004'),
                            freq='U')
        exp = DatetimeIndex(['1970-01-01 00:00:00.000001',
                             '1970-01-01 00:00:00.000002',
                             '1970-01-01 00:00:00.000003',
                             '1970-01-01 00:00:00.000004'])
        tm.assert_index_equal(idx, exp)

        idx = DatetimeIndex(start=Timestamp('1970-01-01 00:00:00.001'),
                            end=Timestamp('1970-01-01 00:00:00.004'),
                            freq='L')
        exp = DatetimeIndex(['1970-01-01 00:00:00.001',
                             '1970-01-01 00:00:00.002',
                             '1970-01-01 00:00:00.003',
                             '1970-01-01 00:00:00.004'])
        tm.assert_index_equal(idx, exp)

        idx = DatetimeIndex(start=Timestamp('1970-01-01 00:00:01'),
                            end=Timestamp('1970-01-01 00:00:04'), freq='S')
        exp = DatetimeIndex(['1970-01-01 00:00:01', '1970-01-01 00:00:02',
                             '1970-01-01 00:00:03', '1970-01-01 00:00:04'])
        tm.assert_index_equal(idx, exp)

        idx = DatetimeIndex(start=Timestamp('1970-01-01 00:01'),
                            end=Timestamp('1970-01-01 00:04'), freq='T')
        exp = DatetimeIndex(['1970-01-01 00:01', '1970-01-01 00:02',
                             '1970-01-01 00:03', '1970-01-01 00:04'])
        tm.assert_index_equal(idx, exp)

        idx = DatetimeIndex(start=Timestamp('1970-01-01 01:00'),
                            end=Timestamp('1970-01-01 04:00'), freq='H')
        exp = DatetimeIndex(['1970-01-01 01:00', '1970-01-01 02:00',
                             '1970-01-01 03:00', '1970-01-01 04:00'])
        tm.assert_index_equal(idx, exp)

        idx = DatetimeIndex(start=Timestamp('1970-01-01'),
                            end=Timestamp('1970-01-04'), freq='D')
        exp = DatetimeIndex(['1970-01-01', '1970-01-02',
                             '1970-01-03', '1970-01-04'])
        tm.assert_index_equal(idx, exp)

    def test_datetimeindex_integers_shift(self):
        rng = date_range('1/1/2000', periods=20)

        result = rng + 5
        expected = rng.shift(5)
        tm.assert_index_equal(result, expected)

        result = rng - 5
        expected = rng.shift(-5)
        tm.assert_index_equal(result, expected)

    def test_datetimeindex_repr_short(self):
        dr = date_range(start='1/1/2012', periods=1)
        repr(dr)

        dr = date_range(start='1/1/2012', periods=2)
        repr(dr)

        dr = date_range(start='1/1/2012', periods=3)
        repr(dr)

    def test_normalize(self):
        rng = date_range('1/1/2000 9:30', periods=10, freq='D')

        result = rng.normalize()
        expected = date_range('1/1/2000', periods=10, freq='D')
        tm.assert_index_equal(result, expected)

        rng_ns = pd.DatetimeIndex(np.array([1380585623454345752,
                                            1380585612343234312]).astype(
                                                "datetime64[ns]"))
        rng_ns_normalized = rng_ns.normalize()
        expected = pd.DatetimeIndex(np.array([1380585600000000000,
                                              1380585600000000000]).astype(
                                                  "datetime64[ns]"))
        tm.assert_index_equal(rng_ns_normalized, expected)

        assert result.is_normalized
        assert not rng.is_normalized


class TestDatetime64(object):

    def test_datetimeindex_accessors(self):

        dti_naive = DatetimeIndex(freq='D', start=datetime(1998, 1, 1),
                                  periods=365)
        # GH 13303
        dti_tz = DatetimeIndex(freq='D', start=datetime(1998, 1, 1),
                               periods=365, tz='US/Eastern')
        for dti in [dti_naive, dti_tz]:

            assert dti.year[0] == 1998
            assert dti.month[0] == 1
            assert dti.day[0] == 1
            assert dti.hour[0] == 0
            assert dti.minute[0] == 0
            assert dti.second[0] == 0
            assert dti.microsecond[0] == 0
            assert dti.dayofweek[0] == 3

            assert dti.dayofyear[0] == 1
            assert dti.dayofyear[120] == 121

            assert dti.weekofyear[0] == 1
            assert dti.weekofyear[120] == 18

            assert dti.quarter[0] == 1
            assert dti.quarter[120] == 2

            assert dti.days_in_month[0] == 31
            assert dti.days_in_month[90] == 30

            assert dti.is_month_start[0]
            assert not dti.is_month_start[1]
            assert dti.is_month_start[31]
            assert dti.is_quarter_start[0]
            assert dti.is_quarter_start[90]
            assert dti.is_year_start[0]
            assert not dti.is_year_start[364]
            assert not dti.is_month_end[0]
            assert dti.is_month_end[30]
            assert not dti.is_month_end[31]
            assert dti.is_month_end[364]
            assert not dti.is_quarter_end[0]
            assert not dti.is_quarter_end[30]
            assert dti.is_quarter_end[89]
            assert dti.is_quarter_end[364]
            assert not dti.is_year_end[0]
            assert dti.is_year_end[364]

            # GH 11128
            assert dti.weekday_name[4] == u'Monday'
            assert dti.weekday_name[5] == u'Tuesday'
            assert dti.weekday_name[6] == u'Wednesday'
            assert dti.weekday_name[7] == u'Thursday'
            assert dti.weekday_name[8] == u'Friday'
            assert dti.weekday_name[9] == u'Saturday'
            assert dti.weekday_name[10] == u'Sunday'

            assert Timestamp('2016-04-04').weekday_name == u'Monday'
            assert Timestamp('2016-04-05').weekday_name == u'Tuesday'
            assert Timestamp('2016-04-06').weekday_name == u'Wednesday'
            assert Timestamp('2016-04-07').weekday_name == u'Thursday'
            assert Timestamp('2016-04-08').weekday_name == u'Friday'
            assert Timestamp('2016-04-09').weekday_name == u'Saturday'
            assert Timestamp('2016-04-10').weekday_name == u'Sunday'

            assert len(dti.year) == 365
            assert len(dti.month) == 365
            assert len(dti.day) == 365
            assert len(dti.hour) == 365
            assert len(dti.minute) == 365
            assert len(dti.second) == 365
            assert len(dti.microsecond) == 365
            assert len(dti.dayofweek) == 365
            assert len(dti.dayofyear) == 365
            assert len(dti.weekofyear) == 365
            assert len(dti.quarter) == 365
            assert len(dti.is_month_start) == 365
            assert len(dti.is_month_end) == 365
            assert len(dti.is_quarter_start) == 365
            assert len(dti.is_quarter_end) == 365
            assert len(dti.is_year_start) == 365
            assert len(dti.is_year_end) == 365
            assert len(dti.weekday_name) == 365

            dti.name = 'name'

            # non boolean accessors -> return Index
            for accessor in DatetimeIndex._field_ops:
                res = getattr(dti, accessor)
                assert len(res) == 365
                assert isinstance(res, Index)
                assert res.name == 'name'

            # boolean accessors -> return array
            for accessor in DatetimeIndex._bool_ops:
                res = getattr(dti, accessor)
                assert len(res) == 365
                assert isinstance(res, np.ndarray)

            # test boolean indexing
            res = dti[dti.is_quarter_start]
            exp = dti[[0, 90, 181, 273]]
            tm.assert_index_equal(res, exp)
            res = dti[dti.is_leap_year]
            exp = DatetimeIndex([], freq='D', tz=dti.tz, name='name')
            tm.assert_index_equal(res, exp)

        dti = DatetimeIndex(freq='BQ-FEB', start=datetime(1998, 1, 1),
                            periods=4)

        assert sum(dti.is_quarter_start) == 0
        assert sum(dti.is_quarter_end) == 4
        assert sum(dti.is_year_start) == 0
        assert sum(dti.is_year_end) == 1

        # Ensure is_start/end accessors throw ValueError for CustomBusinessDay,
        # CBD requires np >= 1.7
        bday_egypt = offsets.CustomBusinessDay(weekmask='Sun Mon Tue Wed Thu')
        dti = date_range(datetime(2013, 4, 30), periods=5, freq=bday_egypt)
        pytest.raises(ValueError, lambda: dti.is_month_start)

        dti = DatetimeIndex(['2000-01-01', '2000-01-02', '2000-01-03'])

        assert dti.is_month_start[0] == 1

        tests = [
            (Timestamp('2013-06-01', freq='M').is_month_start, 1),
            (Timestamp('2013-06-01', freq='BM').is_month_start, 0),
            (Timestamp('2013-06-03', freq='M').is_month_start, 0),
            (Timestamp('2013-06-03', freq='BM').is_month_start, 1),
            (Timestamp('2013-02-28', freq='Q-FEB').is_month_end, 1),
            (Timestamp('2013-02-28', freq='Q-FEB').is_quarter_end, 1),
            (Timestamp('2013-02-28', freq='Q-FEB').is_year_end, 1),
            (Timestamp('2013-03-01', freq='Q-FEB').is_month_start, 1),
            (Timestamp('2013-03-01', freq='Q-FEB').is_quarter_start, 1),
            (Timestamp('2013-03-01', freq='Q-FEB').is_year_start, 1),
            (Timestamp('2013-03-31', freq='QS-FEB').is_month_end, 1),
            (Timestamp('2013-03-31', freq='QS-FEB').is_quarter_end, 0),
            (Timestamp('2013-03-31', freq='QS-FEB').is_year_end, 0),
            (Timestamp('2013-02-01', freq='QS-FEB').is_month_start, 1),
            (Timestamp('2013-02-01', freq='QS-FEB').is_quarter_start, 1),
            (Timestamp('2013-02-01', freq='QS-FEB').is_year_start, 1),
            (Timestamp('2013-06-30', freq='BQ').is_month_end, 0),
            (Timestamp('2013-06-30', freq='BQ').is_quarter_end, 0),
            (Timestamp('2013-06-30', freq='BQ').is_year_end, 0),
            (Timestamp('2013-06-28', freq='BQ').is_month_end, 1),
            (Timestamp('2013-06-28', freq='BQ').is_quarter_end, 1),
            (Timestamp('2013-06-28', freq='BQ').is_year_end, 0),
            (Timestamp('2013-06-30', freq='BQS-APR').is_month_end, 0),
            (Timestamp('2013-06-30', freq='BQS-APR').is_quarter_end, 0),
            (Timestamp('2013-06-30', freq='BQS-APR').is_year_end, 0),
            (Timestamp('2013-06-28', freq='BQS-APR').is_month_end, 1),
            (Timestamp('2013-06-28', freq='BQS-APR').is_quarter_end, 1),
            (Timestamp('2013-03-29', freq='BQS-APR').is_year_end, 1),
            (Timestamp('2013-11-01', freq='AS-NOV').is_year_start, 1),
            (Timestamp('2013-10-31', freq='AS-NOV').is_year_end, 1),
            (Timestamp('2012-02-01').days_in_month, 29),
            (Timestamp('2013-02-01').days_in_month, 28)]

        for ts, value in tests:
            assert ts == value

        # GH 6538: Check that DatetimeIndex and its TimeStamp elements
        # return the same weekofyear accessor close to new year w/ tz
        dates = ["2013/12/29", "2013/12/30", "2013/12/31"]
        dates = DatetimeIndex(dates, tz="Europe/Brussels")
        expected = [52, 1, 1]
        assert dates.weekofyear.tolist() == expected
        assert [d.weekofyear for d in dates] == expected

    def test_nanosecond_field(self):
        dti = DatetimeIndex(np.arange(10))

        tm.assert_index_equal(dti.nanosecond,
                              pd.Index(np.arange(10, dtype=np.int64)))
