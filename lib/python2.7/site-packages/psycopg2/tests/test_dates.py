#!/usr/bin/env python

# test_dates.py - unit test for dates handling
#
# Copyright (C) 2008-2011 James Henstridge  <james@jamesh.id.au>
#
# psycopg2 is free software: you can redistribute it and/or modify it
# under the terms of the GNU Lesser General Public License as published
# by the Free Software Foundation, either version 3 of the License, or
# (at your option) any later version.
#
# In addition, as a special exception, the copyright holders give
# permission to link this program with the OpenSSL library (or with
# modified versions of OpenSSL that use the same license as OpenSSL),
# and distribute linked combinations including the two.
#
# You must obey the GNU Lesser General Public License in all respects for
# all of the code used other than OpenSSL.
#
# psycopg2 is distributed in the hope that it will be useful, but WITHOUT
# ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or
# FITNESS FOR A PARTICULAR PURPOSE.  See the GNU Lesser General Public
# License for more details.

import math
import psycopg2
from psycopg2.tz import FixedOffsetTimezone, ZERO
from testutils import unittest, ConnectingTestCase, skip_before_postgres


def total_seconds(d):
    """Return total number of seconds of a timedelta as a float."""
    return d.days * 24 * 60 * 60 + d.seconds + d.microseconds / 1000000.0


class CommonDatetimeTestsMixin:

    def execute(self, *args):
        self.curs.execute(*args)
        return self.curs.fetchone()[0]

    def test_parse_date(self):
        value = self.DATE('2007-01-01', self.curs)
        self.assert_(value is not None)
        self.assertEqual(value.year, 2007)
        self.assertEqual(value.month, 1)
        self.assertEqual(value.day, 1)

    def test_parse_null_date(self):
        value = self.DATE(None, self.curs)
        self.assertEqual(value, None)

    def test_parse_incomplete_date(self):
        self.assertRaises(psycopg2.DataError, self.DATE, '2007', self.curs)
        self.assertRaises(psycopg2.DataError, self.DATE, '2007-01', self.curs)

    def test_parse_time(self):
        value = self.TIME('13:30:29', self.curs)
        self.assert_(value is not None)
        self.assertEqual(value.hour, 13)
        self.assertEqual(value.minute, 30)
        self.assertEqual(value.second, 29)

    def test_parse_null_time(self):
        value = self.TIME(None, self.curs)
        self.assertEqual(value, None)

    def test_parse_incomplete_time(self):
        self.assertRaises(psycopg2.DataError, self.TIME, '13', self.curs)
        self.assertRaises(psycopg2.DataError, self.TIME, '13:30', self.curs)

    def test_parse_datetime(self):
        value = self.DATETIME('2007-01-01 13:30:29', self.curs)
        self.assert_(value is not None)
        self.assertEqual(value.year, 2007)
        self.assertEqual(value.month, 1)
        self.assertEqual(value.day, 1)
        self.assertEqual(value.hour, 13)
        self.assertEqual(value.minute, 30)
        self.assertEqual(value.second, 29)

    def test_parse_null_datetime(self):
        value = self.DATETIME(None, self.curs)
        self.assertEqual(value, None)

    def test_parse_incomplete_datetime(self):
        self.assertRaises(psycopg2.DataError,
                          self.DATETIME, '2007', self.curs)
        self.assertRaises(psycopg2.DataError,
                          self.DATETIME, '2007-01', self.curs)
        self.assertRaises(psycopg2.DataError,
                          self.DATETIME, '2007-01-01 13', self.curs)
        self.assertRaises(psycopg2.DataError,
                          self.DATETIME, '2007-01-01 13:30', self.curs)

    def test_parse_null_interval(self):
        value = self.INTERVAL(None, self.curs)
        self.assertEqual(value, None)


class DatetimeTests(ConnectingTestCase, CommonDatetimeTestsMixin):
    """Tests for the datetime based date handling in psycopg2."""

    def setUp(self):
        ConnectingTestCase.setUp(self)
        self.curs = self.conn.cursor()
        self.DATE = psycopg2.extensions.PYDATE
        self.TIME = psycopg2.extensions.PYTIME
        self.DATETIME = psycopg2.extensions.PYDATETIME
        self.INTERVAL = psycopg2.extensions.PYINTERVAL

    def test_parse_bc_date(self):
        # datetime does not support BC dates
        self.assertRaises(ValueError, self.DATE, '00042-01-01 BC', self.curs)

    def test_parse_bc_datetime(self):
        # datetime does not support BC dates
        self.assertRaises(ValueError, self.DATETIME,
                          '00042-01-01 13:30:29 BC', self.curs)

    def test_parse_time_microseconds(self):
        value = self.TIME('13:30:29.123456', self.curs)
        self.assertEqual(value.second, 29)
        self.assertEqual(value.microsecond, 123456)

    def test_parse_datetime_microseconds(self):
        value = self.DATETIME('2007-01-01 13:30:29.123456', self.curs)
        self.assertEqual(value.second, 29)
        self.assertEqual(value.microsecond, 123456)

    def check_time_tz(self, str_offset, offset):
        from datetime import time, timedelta
        base = time(13, 30, 29)
        base_str = '13:30:29'

        value = self.TIME(base_str + str_offset, self.curs)

        # Value has time zone info and correct UTC offset.
        self.assertNotEqual(value.tzinfo, None),
        self.assertEqual(value.utcoffset(), timedelta(seconds=offset))

        # Time portion is correct.
        self.assertEqual(value.replace(tzinfo=None), base)

    def test_parse_time_timezone(self):
        self.check_time_tz("+01", 3600)
        self.check_time_tz("-01", -3600)
        self.check_time_tz("+01:15", 4500)
        self.check_time_tz("-01:15", -4500)
        # The Python datetime module does not support time zone
        # offsets that are not a whole number of minutes.
        # We round the offset to the nearest minute.
        self.check_time_tz("+01:15:00", 60 * (60 + 15))
        self.check_time_tz("+01:15:29", 60 * (60 + 15))
        self.check_time_tz("+01:15:30", 60 * (60 + 16))
        self.check_time_tz("+01:15:59", 60 * (60 + 16))
        self.check_time_tz("-01:15:00", -60 * (60 + 15))
        self.check_time_tz("-01:15:29", -60 * (60 + 15))
        self.check_time_tz("-01:15:30", -60 * (60 + 16))
        self.check_time_tz("-01:15:59", -60 * (60 + 16))

    def check_datetime_tz(self, str_offset, offset):
        from datetime import datetime, timedelta
        base = datetime(2007, 1, 1, 13, 30, 29)
        base_str = '2007-01-01 13:30:29'

        value = self.DATETIME(base_str + str_offset, self.curs)

        # Value has time zone info and correct UTC offset.
        self.assertNotEqual(value.tzinfo, None),
        self.assertEqual(value.utcoffset(), timedelta(seconds=offset))

        # Datetime is correct.
        self.assertEqual(value.replace(tzinfo=None), base)

        # Conversion to UTC produces the expected offset.
        UTC = FixedOffsetTimezone(0, "UTC")
        value_utc = value.astimezone(UTC).replace(tzinfo=None)
        self.assertEqual(base - value_utc, timedelta(seconds=offset))

    def test_parse_datetime_timezone(self):
        self.check_datetime_tz("+01", 3600)
        self.check_datetime_tz("-01", -3600)
        self.check_datetime_tz("+01:15", 4500)
        self.check_datetime_tz("-01:15", -4500)
        # The Python datetime module does not support time zone
        # offsets that are not a whole number of minutes.
        # We round the offset to the nearest minute.
        self.check_datetime_tz("+01:15:00", 60 * (60 + 15))
        self.check_datetime_tz("+01:15:29", 60 * (60 + 15))
        self.check_datetime_tz("+01:15:30", 60 * (60 + 16))
        self.check_datetime_tz("+01:15:59", 60 * (60 + 16))
        self.check_datetime_tz("-01:15:00", -60 * (60 + 15))
        self.check_datetime_tz("-01:15:29", -60 * (60 + 15))
        self.check_datetime_tz("-01:15:30", -60 * (60 + 16))
        self.check_datetime_tz("-01:15:59", -60 * (60 + 16))

    def test_parse_time_no_timezone(self):
        self.assertEqual(self.TIME("13:30:29", self.curs).tzinfo, None)
        self.assertEqual(self.TIME("13:30:29.123456", self.curs).tzinfo, None)

    def test_parse_datetime_no_timezone(self):
        self.assertEqual(
            self.DATETIME("2007-01-01 13:30:29", self.curs).tzinfo, None)
        self.assertEqual(
            self.DATETIME("2007-01-01 13:30:29.123456", self.curs).tzinfo, None)

    def test_parse_interval(self):
        value = self.INTERVAL('42 days 12:34:56.123456', self.curs)
        self.assertNotEqual(value, None)
        self.assertEqual(value.days, 42)
        self.assertEqual(value.seconds, 45296)
        self.assertEqual(value.microseconds, 123456)

    def test_parse_negative_interval(self):
        value = self.INTERVAL('-42 days -12:34:56.123456', self.curs)
        self.assertNotEqual(value, None)
        self.assertEqual(value.days, -43)
        self.assertEqual(value.seconds, 41103)
        self.assertEqual(value.microseconds, 876544)

    def test_parse_infinity(self):
        value = self.DATETIME('-infinity', self.curs)
        self.assertEqual(str(value), '0001-01-01 00:00:00')
        value = self.DATETIME('infinity', self.curs)
        self.assertEqual(str(value), '9999-12-31 23:59:59.999999')
        value = self.DATE('infinity', self.curs)
        self.assertEqual(str(value), '9999-12-31')

    def test_adapt_date(self):
        from datetime import date
        value = self.execute('select (%s)::date::text',
                             [date(2007, 1, 1)])
        self.assertEqual(value, '2007-01-01')

    def test_adapt_time(self):
        from datetime import time
        value = self.execute('select (%s)::time::text',
                             [time(13, 30, 29)])
        self.assertEqual(value, '13:30:29')

    def test_adapt_datetime(self):
        from datetime import datetime
        value = self.execute('select (%s)::timestamp::text',
                             [datetime(2007, 1, 1, 13, 30, 29)])
        self.assertEqual(value, '2007-01-01 13:30:29')

    def test_adapt_timedelta(self):
        from datetime import timedelta
        value = self.execute('select extract(epoch from (%s)::interval)',
                             [timedelta(days=42, seconds=45296,
                                        microseconds=123456)])
        seconds = math.floor(value)
        self.assertEqual(seconds, 3674096)
        self.assertEqual(int(round((value - seconds) * 1000000)), 123456)

    def test_adapt_negative_timedelta(self):
        from datetime import timedelta
        value = self.execute('select extract(epoch from (%s)::interval)',
                             [timedelta(days=-42, seconds=45296,
                                        microseconds=123456)])
        seconds = math.floor(value)
        self.assertEqual(seconds, -3583504)
        self.assertEqual(int(round((value - seconds) * 1000000)), 123456)

    def _test_type_roundtrip(self, o1):
        o2 = self.execute("select %s;", (o1,))
        self.assertEqual(type(o1), type(o2))
        return o2

    def _test_type_roundtrip_array(self, o1):
        o1 = [o1]
        o2 = self.execute("select %s;", (o1,))
        self.assertEqual(type(o1[0]), type(o2[0]))

    def test_type_roundtrip_date(self):
        from datetime import date
        self._test_type_roundtrip(date(2010, 5, 3))

    def test_type_roundtrip_datetime(self):
        from datetime import datetime
        dt = self._test_type_roundtrip(datetime(2010, 5, 3, 10, 20, 30))
        self.assertEqual(None, dt.tzinfo)

    def test_type_roundtrip_datetimetz(self):
        from datetime import datetime
        import psycopg2.tz
        tz = psycopg2.tz.FixedOffsetTimezone(8 * 60)
        dt1 = datetime(2010, 5, 3, 10, 20, 30, tzinfo=tz)
        dt2 = self._test_type_roundtrip(dt1)
        self.assertNotEqual(None, dt2.tzinfo)
        self.assertEqual(dt1, dt2)

    def test_type_roundtrip_time(self):
        from datetime import time
        tm = self._test_type_roundtrip(time(10, 20, 30))
        self.assertEqual(None, tm.tzinfo)

    def test_type_roundtrip_timetz(self):
        from datetime import time
        import psycopg2.tz
        tz = psycopg2.tz.FixedOffsetTimezone(8 * 60)
        tm1 = time(10, 20, 30, tzinfo=tz)
        tm2 = self._test_type_roundtrip(tm1)
        self.assertNotEqual(None, tm2.tzinfo)
        self.assertEqual(tm1, tm2)

    def test_type_roundtrip_interval(self):
        from datetime import timedelta
        self._test_type_roundtrip(timedelta(seconds=30))

    def test_type_roundtrip_date_array(self):
        from datetime import date
        self._test_type_roundtrip_array(date(2010, 5, 3))

    def test_type_roundtrip_datetime_array(self):
        from datetime import datetime
        self._test_type_roundtrip_array(datetime(2010, 5, 3, 10, 20, 30))

    def test_type_roundtrip_time_array(self):
        from datetime import time
        self._test_type_roundtrip_array(time(10, 20, 30))

    def test_type_roundtrip_interval_array(self):
        from datetime import timedelta
        self._test_type_roundtrip_array(timedelta(seconds=30))

    @skip_before_postgres(8, 1)
    def test_time_24(self):
        from datetime import time

        t = self.execute("select '24:00'::time;")
        self.assertEqual(t, time(0, 0))

        t = self.execute("select '24:00+05'::timetz;")
        self.assertEqual(t, time(0, 0, tzinfo=FixedOffsetTimezone(300)))

        t = self.execute("select '24:00+05:30'::timetz;")
        self.assertEqual(t, time(0, 0, tzinfo=FixedOffsetTimezone(330)))

    @skip_before_postgres(8, 1)
    def test_large_interval(self):
        t = self.execute("select '999999:00:00'::interval")
        self.assertEqual(total_seconds(t), 999999 * 60 * 60)

        t = self.execute("select '-999999:00:00'::interval")
        self.assertEqual(total_seconds(t), -999999 * 60 * 60)

        t = self.execute("select '999999:00:00.1'::interval")
        self.assertEqual(total_seconds(t), 999999 * 60 * 60 + 0.1)

        t = self.execute("select '999999:00:00.9'::interval")
        self.assertEqual(total_seconds(t), 999999 * 60 * 60 + 0.9)

        t = self.execute("select '-999999:00:00.1'::interval")
        self.assertEqual(total_seconds(t), -999999 * 60 * 60 - 0.1)

        t = self.execute("select '-999999:00:00.9'::interval")
        self.assertEqual(total_seconds(t), -999999 * 60 * 60 - 0.9)

    def test_micros_rounding(self):
        t = self.execute("select '0.1'::interval")
        self.assertEqual(total_seconds(t), 0.1)

        t = self.execute("select '0.01'::interval")
        self.assertEqual(total_seconds(t), 0.01)

        t = self.execute("select '0.000001'::interval")
        self.assertEqual(total_seconds(t), 1e-6)

        t = self.execute("select '0.0000004'::interval")
        self.assertEqual(total_seconds(t), 0)

        t = self.execute("select '0.0000006'::interval")
        self.assertEqual(total_seconds(t), 1e-6)

    def test_interval_overflow(self):
        cur = self.conn.cursor()
        # hack a cursor to receive values too extreme to be represented
        # but still I want an error, not a random number
        psycopg2.extensions.register_type(
            psycopg2.extensions.new_type(
                psycopg2.STRING.values, 'WAT', psycopg2.extensions.INTERVAL),
            cur)

        def f(val):
            cur.execute("select '%s'::text" % val)
            return cur.fetchone()[0]

        self.assertRaises(OverflowError, f, '100000000000000000:00:00')
        self.assertRaises(OverflowError, f, '00:100000000000000000:00:00')
        self.assertRaises(OverflowError, f, '00:00:100000000000000000:00')
        self.assertRaises(OverflowError, f, '00:00:00.100000000000000000')


# Only run the datetime tests if psycopg was compiled with support.
if not hasattr(psycopg2.extensions, 'PYDATETIME'):
    del DatetimeTests


class mxDateTimeTests(ConnectingTestCase, CommonDatetimeTestsMixin):
    """Tests for the mx.DateTime based date handling in psycopg2."""

    def setUp(self):
        ConnectingTestCase.setUp(self)
        self.curs = self.conn.cursor()
        self.DATE = psycopg2._psycopg.MXDATE
        self.TIME = psycopg2._psycopg.MXTIME
        self.DATETIME = psycopg2._psycopg.MXDATETIME
        self.INTERVAL = psycopg2._psycopg.MXINTERVAL

        psycopg2.extensions.register_type(self.DATE, self.conn)
        psycopg2.extensions.register_type(self.TIME, self.conn)
        psycopg2.extensions.register_type(self.DATETIME, self.conn)
        psycopg2.extensions.register_type(self.INTERVAL, self.conn)
        psycopg2.extensions.register_type(psycopg2.extensions.MXDATEARRAY, self.conn)
        psycopg2.extensions.register_type(psycopg2.extensions.MXTIMEARRAY, self.conn)
        psycopg2.extensions.register_type(
            psycopg2.extensions.MXDATETIMEARRAY, self.conn)
        psycopg2.extensions.register_type(
            psycopg2.extensions.MXINTERVALARRAY, self.conn)

    def tearDown(self):
        self.conn.close()

    def test_parse_bc_date(self):
        value = self.DATE('00042-01-01 BC', self.curs)
        self.assert_(value is not None)
        # mx.DateTime numbers BC dates from 0 rather than 1.
        self.assertEqual(value.year, -41)
        self.assertEqual(value.month, 1)
        self.assertEqual(value.day, 1)

    def test_parse_bc_datetime(self):
        value = self.DATETIME('00042-01-01 13:30:29 BC', self.curs)
        self.assert_(value is not None)
        # mx.DateTime numbers BC dates from 0 rather than 1.
        self.assertEqual(value.year, -41)
        self.assertEqual(value.month, 1)
        self.assertEqual(value.day, 1)
        self.assertEqual(value.hour, 13)
        self.assertEqual(value.minute, 30)
        self.assertEqual(value.second, 29)

    def test_parse_time_microseconds(self):
        value = self.TIME('13:30:29.123456', self.curs)
        self.assertEqual(math.floor(value.second), 29)
        self.assertEqual(
            int((value.second - math.floor(value.second)) * 1000000), 123456)

    def test_parse_datetime_microseconds(self):
        value = self.DATETIME('2007-01-01 13:30:29.123456', self.curs)
        self.assertEqual(math.floor(value.second), 29)
        self.assertEqual(
            int((value.second - math.floor(value.second)) * 1000000), 123456)

    def test_parse_time_timezone(self):
        # Time zone information is ignored.
        from mx.DateTime import Time
        expected = Time(13, 30, 29)
        self.assertEqual(expected, self.TIME("13:30:29+01", self.curs))
        self.assertEqual(expected, self.TIME("13:30:29-01", self.curs))
        self.assertEqual(expected, self.TIME("13:30:29+01:15", self.curs))
        self.assertEqual(expected, self.TIME("13:30:29-01:15", self.curs))
        self.assertEqual(expected, self.TIME("13:30:29+01:15:42", self.curs))
        self.assertEqual(expected, self.TIME("13:30:29-01:15:42", self.curs))

    def test_parse_datetime_timezone(self):
        # Time zone information is ignored.
        from mx.DateTime import DateTime
        expected = DateTime(2007, 1, 1, 13, 30, 29)
        self.assertEqual(
            expected, self.DATETIME("2007-01-01 13:30:29+01", self.curs))
        self.assertEqual(
            expected, self.DATETIME("2007-01-01 13:30:29-01", self.curs))
        self.assertEqual(
            expected, self.DATETIME("2007-01-01 13:30:29+01:15", self.curs))
        self.assertEqual(
            expected, self.DATETIME("2007-01-01 13:30:29-01:15", self.curs))
        self.assertEqual(
            expected, self.DATETIME("2007-01-01 13:30:29+01:15:42", self.curs))
        self.assertEqual(
            expected, self.DATETIME("2007-01-01 13:30:29-01:15:42", self.curs))

    def test_parse_interval(self):
        value = self.INTERVAL('42 days 05:50:05', self.curs)
        self.assert_(value is not None)
        self.assertEqual(value.day, 42)
        self.assertEqual(value.hour, 5)
        self.assertEqual(value.minute, 50)
        self.assertEqual(value.second, 5)

    def test_adapt_time(self):
        from mx.DateTime import Time
        value = self.execute('select (%s)::time::text',
                             [Time(13, 30, 29)])
        self.assertEqual(value, '13:30:29')

    def test_adapt_datetime(self):
        from mx.DateTime import DateTime
        value = self.execute('select (%s)::timestamp::text',
                             [DateTime(2007, 1, 1, 13, 30, 29.123456)])
        self.assertEqual(value, '2007-01-01 13:30:29.123456')

    def test_adapt_bc_datetime(self):
        from mx.DateTime import DateTime
        value = self.execute('select (%s)::timestamp::text',
                             [DateTime(-41, 1, 1, 13, 30, 29.123456)])
        # microsecs for BC timestamps look not available in PG < 8.4
        # but more likely it's determined at compile time.
        self.assert_(value in (
            '0042-01-01 13:30:29.123456 BC',
            '0042-01-01 13:30:29 BC'), value)

    def test_adapt_timedelta(self):
        from mx.DateTime import DateTimeDeltaFrom
        value = self.execute('select extract(epoch from (%s)::interval)',
                             [DateTimeDeltaFrom(days=42,
                                                seconds=45296.123456)])
        seconds = math.floor(value)
        self.assertEqual(seconds, 3674096)
        self.assertEqual(int(round((value - seconds) * 1000000)), 123456)

    def test_adapt_negative_timedelta(self):
        from mx.DateTime import DateTimeDeltaFrom
        value = self.execute('select extract(epoch from (%s)::interval)',
                             [DateTimeDeltaFrom(days=-42,
                                                seconds=45296.123456)])
        seconds = math.floor(value)
        self.assertEqual(seconds, -3583504)
        self.assertEqual(int(round((value - seconds) * 1000000)), 123456)

    def _test_type_roundtrip(self, o1):
        o2 = self.execute("select %s;", (o1,))
        self.assertEqual(type(o1), type(o2))

    def _test_type_roundtrip_array(self, o1):
        o1 = [o1]
        o2 = self.execute("select %s;", (o1,))
        self.assertEqual(type(o1[0]), type(o2[0]))

    def test_type_roundtrip_date(self):
        from mx.DateTime import Date
        self._test_type_roundtrip(Date(2010, 5, 3))

    def test_type_roundtrip_datetime(self):
        from mx.DateTime import DateTime
        self._test_type_roundtrip(DateTime(2010, 5, 3, 10, 20, 30))

    def test_type_roundtrip_time(self):
        from mx.DateTime import Time
        self._test_type_roundtrip(Time(10, 20, 30))

    def test_type_roundtrip_interval(self):
        from mx.DateTime import DateTimeDeltaFrom
        self._test_type_roundtrip(DateTimeDeltaFrom(seconds=30))

    def test_type_roundtrip_date_array(self):
        from mx.DateTime import Date
        self._test_type_roundtrip_array(Date(2010, 5, 3))

    def test_type_roundtrip_datetime_array(self):
        from mx.DateTime import DateTime
        self._test_type_roundtrip_array(DateTime(2010, 5, 3, 10, 20, 30))

    def test_type_roundtrip_time_array(self):
        from mx.DateTime import Time
        self._test_type_roundtrip_array(Time(10, 20, 30))

    def test_type_roundtrip_interval_array(self):
        from mx.DateTime import DateTimeDeltaFrom
        self._test_type_roundtrip_array(DateTimeDeltaFrom(seconds=30))


# Only run the mx.DateTime tests if psycopg was compiled with support.
try:
    if not hasattr(psycopg2._psycopg, 'MXDATETIME'):
        del mxDateTimeTests
except AttributeError:
    del mxDateTimeTests


class FromTicksTestCase(unittest.TestCase):
    # bug "TimestampFromTicks() throws ValueError (2-2.0.14)"
    # reported by Jozsef Szalay on 2010-05-06
    def test_timestamp_value_error_sec_59_99(self):
        from datetime import datetime
        s = psycopg2.TimestampFromTicks(1273173119.99992)
        self.assertEqual(s.adapted,
            datetime(2010, 5, 6, 14, 11, 59, 999920,
                tzinfo=FixedOffsetTimezone(-5 * 60)))

    def test_date_value_error_sec_59_99(self):
        from datetime import date
        s = psycopg2.DateFromTicks(1273173119.99992)
        self.assertEqual(s.adapted, date(2010, 5, 6))

    def test_time_value_error_sec_59_99(self):
        from datetime import time
        s = psycopg2.TimeFromTicks(1273173119.99992)
        self.assertEqual(s.adapted.replace(hour=0),
            time(0, 11, 59, 999920))


class FixedOffsetTimezoneTests(unittest.TestCase):

    def test_init_with_no_args(self):
        tzinfo = FixedOffsetTimezone()
        self.assert_(tzinfo._offset is ZERO)
        self.assert_(tzinfo._name is None)

    def test_repr_with_positive_offset(self):
        tzinfo = FixedOffsetTimezone(5 * 60)
        self.assertEqual(repr(tzinfo),
            "psycopg2.tz.FixedOffsetTimezone(offset=300, name=None)")

    def test_repr_with_negative_offset(self):
        tzinfo = FixedOffsetTimezone(-5 * 60)
        self.assertEqual(repr(tzinfo),
            "psycopg2.tz.FixedOffsetTimezone(offset=-300, name=None)")

    def test_repr_with_name(self):
        tzinfo = FixedOffsetTimezone(name="FOO")
        self.assertEqual(repr(tzinfo),
            "psycopg2.tz.FixedOffsetTimezone(offset=0, name='FOO')")

    def test_instance_caching(self):
        self.assert_(FixedOffsetTimezone(name="FOO")
            is FixedOffsetTimezone(name="FOO"))
        self.assert_(FixedOffsetTimezone(7 * 60)
            is FixedOffsetTimezone(7 * 60))
        self.assert_(FixedOffsetTimezone(-9 * 60, 'FOO')
            is FixedOffsetTimezone(-9 * 60, 'FOO'))
        self.assert_(FixedOffsetTimezone(9 * 60)
            is not FixedOffsetTimezone(9 * 60, 'FOO'))
        self.assert_(FixedOffsetTimezone(name='FOO')
            is not FixedOffsetTimezone(9 * 60, 'FOO'))

    def test_pickle(self):
        # ticket #135
        import pickle

        tz11 = FixedOffsetTimezone(60)
        tz12 = FixedOffsetTimezone(120)
        for proto in [-1, 0, 1, 2]:
            tz21, tz22 = pickle.loads(pickle.dumps([tz11, tz12], proto))
            self.assertEqual(tz11, tz21)
            self.assertEqual(tz12, tz22)

        tz11 = FixedOffsetTimezone(60, name='foo')
        tz12 = FixedOffsetTimezone(120, name='bar')
        for proto in [-1, 0, 1, 2]:
            tz21, tz22 = pickle.loads(pickle.dumps([tz11, tz12], proto))
            self.assertEqual(tz11, tz21)
            self.assertEqual(tz12, tz22)


def test_suite():
    return unittest.TestLoader().loadTestsFromName(__name__)

if __name__ == "__main__":
    unittest.main()
