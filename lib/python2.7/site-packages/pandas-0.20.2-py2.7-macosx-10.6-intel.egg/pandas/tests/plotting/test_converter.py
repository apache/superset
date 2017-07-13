import pytest
from datetime import datetime, date

import numpy as np
from pandas import Timestamp, Period, Index
from pandas.compat import u
import pandas.util.testing as tm
from pandas.tseries.offsets import Second, Milli, Micro, Day
from pandas.compat.numpy import np_datetime64_compat

converter = pytest.importorskip('pandas.plotting._converter')


def test_timtetonum_accepts_unicode():
    assert (converter.time2num("00:01") == converter.time2num(u("00:01")))


class TestDateTimeConverter(object):

    def setup_method(self, method):
        self.dtc = converter.DatetimeConverter()
        self.tc = converter.TimeFormatter(None)

    def test_convert_accepts_unicode(self):
        r1 = self.dtc.convert("12:22", None, None)
        r2 = self.dtc.convert(u("12:22"), None, None)
        assert (r1 == r2), "DatetimeConverter.convert should accept unicode"

    def test_conversion(self):
        rs = self.dtc.convert(['2012-1-1'], None, None)[0]
        xp = datetime(2012, 1, 1).toordinal()
        assert rs == xp

        rs = self.dtc.convert('2012-1-1', None, None)
        assert rs == xp

        rs = self.dtc.convert(date(2012, 1, 1), None, None)
        assert rs == xp

        rs = self.dtc.convert(datetime(2012, 1, 1).toordinal(), None, None)
        assert rs == xp

        rs = self.dtc.convert('2012-1-1', None, None)
        assert rs == xp

        rs = self.dtc.convert(Timestamp('2012-1-1'), None, None)
        assert rs == xp

        # also testing datetime64 dtype (GH8614)
        rs = self.dtc.convert(np_datetime64_compat('2012-01-01'), None, None)
        assert rs == xp

        rs = self.dtc.convert(np_datetime64_compat(
            '2012-01-01 00:00:00+0000'), None, None)
        assert rs == xp

        rs = self.dtc.convert(np.array([
            np_datetime64_compat('2012-01-01 00:00:00+0000'),
            np_datetime64_compat('2012-01-02 00:00:00+0000')]), None, None)
        assert rs[0] == xp

        # we have a tz-aware date (constructed to that when we turn to utc it
        # is the same as our sample)
        ts = (Timestamp('2012-01-01')
              .tz_localize('UTC')
              .tz_convert('US/Eastern')
              )
        rs = self.dtc.convert(ts, None, None)
        assert rs == xp

        rs = self.dtc.convert(ts.to_pydatetime(), None, None)
        assert rs == xp

        rs = self.dtc.convert(Index([ts - Day(1), ts]), None, None)
        assert rs[1] == xp

        rs = self.dtc.convert(Index([ts - Day(1), ts]).to_pydatetime(),
                              None, None)
        assert rs[1] == xp

    def test_conversion_float(self):
        decimals = 9

        rs = self.dtc.convert(
            Timestamp('2012-1-1 01:02:03', tz='UTC'), None, None)
        xp = converter.dates.date2num(Timestamp('2012-1-1 01:02:03', tz='UTC'))
        tm.assert_almost_equal(rs, xp, decimals)

        rs = self.dtc.convert(
            Timestamp('2012-1-1 09:02:03', tz='Asia/Hong_Kong'), None, None)
        tm.assert_almost_equal(rs, xp, decimals)

        rs = self.dtc.convert(datetime(2012, 1, 1, 1, 2, 3), None, None)
        tm.assert_almost_equal(rs, xp, decimals)

    def test_conversion_outofbounds_datetime(self):
        # 2579
        values = [date(1677, 1, 1), date(1677, 1, 2)]
        rs = self.dtc.convert(values, None, None)
        xp = converter.dates.date2num(values)
        tm.assert_numpy_array_equal(rs, xp)
        rs = self.dtc.convert(values[0], None, None)
        xp = converter.dates.date2num(values[0])
        assert rs == xp

        values = [datetime(1677, 1, 1, 12), datetime(1677, 1, 2, 12)]
        rs = self.dtc.convert(values, None, None)
        xp = converter.dates.date2num(values)
        tm.assert_numpy_array_equal(rs, xp)
        rs = self.dtc.convert(values[0], None, None)
        xp = converter.dates.date2num(values[0])
        assert rs == xp

    def test_time_formatter(self):
        self.tc(90000)

    def test_dateindex_conversion(self):
        decimals = 9

        for freq in ('B', 'L', 'S'):
            dateindex = tm.makeDateIndex(k=10, freq=freq)
            rs = self.dtc.convert(dateindex, None, None)
            xp = converter.dates.date2num(dateindex._mpl_repr())
            tm.assert_almost_equal(rs, xp, decimals)

    def test_resolution(self):
        def _assert_less(ts1, ts2):
            val1 = self.dtc.convert(ts1, None, None)
            val2 = self.dtc.convert(ts2, None, None)
            if not val1 < val2:
                raise AssertionError('{0} is not less than {1}.'.format(val1,
                                                                        val2))

        # Matplotlib's time representation using floats cannot distinguish
        # intervals smaller than ~10 microsecond in the common range of years.
        ts = Timestamp('2012-1-1')
        _assert_less(ts, ts + Second())
        _assert_less(ts, ts + Milli())
        _assert_less(ts, ts + Micro(50))

    def test_convert_nested(self):
        inner = [Timestamp('2017-01-01', Timestamp('2017-01-02'))]
        data = [inner, inner]
        result = self.dtc.convert(data, None, None)
        expected = [self.dtc.convert(x, None, None) for x in data]
        assert result == expected


class TestPeriodConverter(object):

    def setup_method(self, method):
        self.pc = converter.PeriodConverter()

        class Axis(object):
            pass

        self.axis = Axis()
        self.axis.freq = 'D'

    def test_convert_accepts_unicode(self):
        r1 = self.pc.convert("2012-1-1", None, self.axis)
        r2 = self.pc.convert(u("2012-1-1"), None, self.axis)
        assert r1 == r2

    def test_conversion(self):
        rs = self.pc.convert(['2012-1-1'], None, self.axis)[0]
        xp = Period('2012-1-1').ordinal
        assert rs == xp

        rs = self.pc.convert('2012-1-1', None, self.axis)
        assert rs == xp

        rs = self.pc.convert([date(2012, 1, 1)], None, self.axis)[0]
        assert rs == xp

        rs = self.pc.convert(date(2012, 1, 1), None, self.axis)
        assert rs == xp

        rs = self.pc.convert([Timestamp('2012-1-1')], None, self.axis)[0]
        assert rs == xp

        rs = self.pc.convert(Timestamp('2012-1-1'), None, self.axis)
        assert rs == xp

        # FIXME
        # rs = self.pc.convert(
        #        np_datetime64_compat('2012-01-01'), None, self.axis)
        # assert rs == xp
        #
        # rs = self.pc.convert(
        #        np_datetime64_compat('2012-01-01 00:00:00+0000'),
        #                      None, self.axis)
        # assert rs == xp
        #
        # rs = self.pc.convert(np.array([
        #     np_datetime64_compat('2012-01-01 00:00:00+0000'),
        #     np_datetime64_compat('2012-01-02 00:00:00+0000')]),
        #                          None, self.axis)
        # assert rs[0] == xp

    def test_integer_passthrough(self):
        # GH9012
        rs = self.pc.convert([0, 1], None, self.axis)
        xp = [0, 1]
        assert rs == xp

    def test_convert_nested(self):
        data = ['2012-1-1', '2012-1-2']
        r1 = self.pc.convert([data, data], None, self.axis)
        r2 = [self.pc.convert(data, None, self.axis) for _ in range(2)]
        assert r1 == r2
