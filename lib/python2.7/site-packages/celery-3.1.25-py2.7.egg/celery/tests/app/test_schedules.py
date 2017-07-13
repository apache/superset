from __future__ import absolute_import

import time

from contextlib import contextmanager
from datetime import datetime, timedelta
from pickle import dumps, loads

from celery.five import items
from celery.schedules import ParseException, crontab, crontab_parser
from celery.tests.case import AppCase, SkipTest


@contextmanager
def patch_crontab_nowfun(cls, retval):
    prev_nowfun = cls.nowfun
    cls.nowfun = lambda: retval
    try:
        yield
    finally:
        cls.nowfun = prev_nowfun


class test_crontab_parser(AppCase):

    def crontab(self, *args, **kwargs):
        return crontab(*args, **dict(kwargs, app=self.app))

    def test_crontab_reduce(self):
        self.assertTrue(loads(dumps(self.crontab('*'))))

    def test_range_steps_not_enough(self):
        with self.assertRaises(crontab_parser.ParseException):
            crontab_parser(24)._range_steps([1])

    def test_parse_star(self):
        self.assertEqual(crontab_parser(24).parse('*'), set(range(24)))
        self.assertEqual(crontab_parser(60).parse('*'), set(range(60)))
        self.assertEqual(crontab_parser(7).parse('*'), set(range(7)))
        self.assertEqual(crontab_parser(31, 1).parse('*'),
                         set(range(1, 31 + 1)))
        self.assertEqual(crontab_parser(12, 1).parse('*'),
                         set(range(1, 12 + 1)))

    def test_parse_range(self):
        self.assertEqual(crontab_parser(60).parse('1-10'),
                         set(range(1, 10 + 1)))
        self.assertEqual(crontab_parser(24).parse('0-20'),
                         set(range(0, 20 + 1)))
        self.assertEqual(crontab_parser().parse('2-10'),
                         set(range(2, 10 + 1)))
        self.assertEqual(crontab_parser(60, 1).parse('1-10'),
                         set(range(1, 10 + 1)))

    def test_parse_range_wraps(self):
        self.assertEqual(crontab_parser(12).parse('11-1'),
                         set([11, 0, 1]))
        self.assertEqual(crontab_parser(60, 1).parse('2-1'),
                         set(range(1, 60 + 1)))

    def test_parse_groups(self):
        self.assertEqual(crontab_parser().parse('1,2,3,4'),
                         set([1, 2, 3, 4]))
        self.assertEqual(crontab_parser().parse('0,15,30,45'),
                         set([0, 15, 30, 45]))
        self.assertEqual(crontab_parser(min_=1).parse('1,2,3,4'),
                         set([1, 2, 3, 4]))

    def test_parse_steps(self):
        self.assertEqual(crontab_parser(8).parse('*/2'),
                         set([0, 2, 4, 6]))
        self.assertEqual(crontab_parser().parse('*/2'),
                         set(i * 2 for i in range(30)))
        self.assertEqual(crontab_parser().parse('*/3'),
                         set(i * 3 for i in range(20)))
        self.assertEqual(crontab_parser(8, 1).parse('*/2'),
                         set([1, 3, 5, 7]))
        self.assertEqual(crontab_parser(min_=1).parse('*/2'),
                         set(i * 2 + 1 for i in range(30)))
        self.assertEqual(crontab_parser(min_=1).parse('*/3'),
                         set(i * 3 + 1 for i in range(20)))

    def test_parse_composite(self):
        self.assertEqual(crontab_parser(8).parse('*/2'), set([0, 2, 4, 6]))
        self.assertEqual(crontab_parser().parse('2-9/5'), set([2, 7]))
        self.assertEqual(crontab_parser().parse('2-10/5'), set([2, 7]))
        self.assertEqual(
            crontab_parser(min_=1).parse('55-5/3'),
            set([55, 58, 1, 4]),
        )
        self.assertEqual(crontab_parser().parse('2-11/5,3'), set([2, 3, 7]))
        self.assertEqual(
            crontab_parser().parse('2-4/3,*/5,0-21/4'),
            set([0, 2, 4, 5, 8, 10, 12, 15, 16,
                 20, 25, 30, 35, 40, 45, 50, 55]),
        )
        self.assertEqual(
            crontab_parser().parse('1-9/2'),
            set([1, 3, 5, 7, 9]),
        )
        self.assertEqual(crontab_parser(8, 1).parse('*/2'), set([1, 3, 5, 7]))
        self.assertEqual(crontab_parser(min_=1).parse('2-9/5'), set([2, 7]))
        self.assertEqual(crontab_parser(min_=1).parse('2-10/5'), set([2, 7]))
        self.assertEqual(
            crontab_parser(min_=1).parse('2-11/5,3'),
            set([2, 3, 7]),
        )
        self.assertEqual(
            crontab_parser(min_=1).parse('2-4/3,*/5,1-21/4'),
            set([1, 2, 5, 6, 9, 11, 13, 16, 17,
                 21, 26, 31, 36, 41, 46, 51, 56]),
        )
        self.assertEqual(
            crontab_parser(min_=1).parse('1-9/2'),
            set([1, 3, 5, 7, 9]),
        )

    def test_parse_errors_on_empty_string(self):
        with self.assertRaises(ParseException):
            crontab_parser(60).parse('')

    def test_parse_errors_on_empty_group(self):
        with self.assertRaises(ParseException):
            crontab_parser(60).parse('1,,2')

    def test_parse_errors_on_empty_steps(self):
        with self.assertRaises(ParseException):
            crontab_parser(60).parse('*/')

    def test_parse_errors_on_negative_number(self):
        with self.assertRaises(ParseException):
            crontab_parser(60).parse('-20')

    def test_parse_errors_on_lt_min(self):
        crontab_parser(min_=1).parse('1')
        with self.assertRaises(ValueError):
            crontab_parser(12, 1).parse('0')
        with self.assertRaises(ValueError):
            crontab_parser(24, 1).parse('12-0')

    def test_parse_errors_on_gt_max(self):
        crontab_parser(1).parse('0')
        with self.assertRaises(ValueError):
            crontab_parser(1).parse('1')
        with self.assertRaises(ValueError):
            crontab_parser(60).parse('61-0')

    def test_expand_cronspec_eats_iterables(self):
        self.assertEqual(
            crontab._expand_cronspec(iter([1, 2, 3]), 100),
            set([1, 2, 3]),
        )
        self.assertEqual(
            crontab._expand_cronspec(iter([1, 2, 3]), 100, 1),
            set([1, 2, 3]),
        )

    def test_expand_cronspec_invalid_type(self):
        with self.assertRaises(TypeError):
            crontab._expand_cronspec(object(), 100)

    def test_repr(self):
        self.assertIn('*', repr(self.crontab('*')))

    def test_eq(self):
        self.assertEqual(
            self.crontab(day_of_week='1, 2'),
            self.crontab(day_of_week='1-2'),
        )
        self.assertEqual(
            self.crontab(day_of_month='1, 16, 31'),
            self.crontab(day_of_month='*/15'),
        )
        self.assertEqual(
            self.crontab(minute='1', hour='2', day_of_week='5',
                         day_of_month='10', month_of_year='5'),
            self.crontab(minute='1', hour='2', day_of_week='5',
                         day_of_month='10', month_of_year='5'),
        )
        self.assertNotEqual(crontab(minute='1'), crontab(minute='2'))
        self.assertNotEqual(
            self.crontab(month_of_year='1'),
            self.crontab(month_of_year='2'),
        )
        self.assertFalse(object() == self.crontab(minute='1'))
        self.assertFalse(self.crontab(minute='1') == object())


class test_crontab_remaining_estimate(AppCase):

    def crontab(self, *args, **kwargs):
        return crontab(*args, **dict(kwargs, app=self.app))

    def next_ocurrance(self, crontab, now):
        crontab.nowfun = lambda: now
        return now + crontab.remaining_estimate(now)

    def test_next_minute(self):
        next = self.next_ocurrance(
            self.crontab(), datetime(2010, 9, 11, 14, 30, 15),
        )
        self.assertEqual(next, datetime(2010, 9, 11, 14, 31))

    def test_not_next_minute(self):
        next = self.next_ocurrance(
            self.crontab(), datetime(2010, 9, 11, 14, 59, 15),
        )
        self.assertEqual(next, datetime(2010, 9, 11, 15, 0))

    def test_this_hour(self):
        next = self.next_ocurrance(
            self.crontab(minute=[5, 42]), datetime(2010, 9, 11, 14, 30, 15),
        )
        self.assertEqual(next, datetime(2010, 9, 11, 14, 42))

    def test_not_this_hour(self):
        next = self.next_ocurrance(
            self.crontab(minute=[5, 10, 15]),
            datetime(2010, 9, 11, 14, 30, 15),
        )
        self.assertEqual(next, datetime(2010, 9, 11, 15, 5))

    def test_today(self):
        next = self.next_ocurrance(
            self.crontab(minute=[5, 42], hour=[12, 17]),
            datetime(2010, 9, 11, 14, 30, 15),
        )
        self.assertEqual(next, datetime(2010, 9, 11, 17, 5))

    def test_not_today(self):
        next = self.next_ocurrance(
            self.crontab(minute=[5, 42], hour=[12]),
            datetime(2010, 9, 11, 14, 30, 15),
        )
        self.assertEqual(next, datetime(2010, 9, 12, 12, 5))

    def test_weekday(self):
        next = self.next_ocurrance(
            self.crontab(minute=30, hour=14, day_of_week='sat'),
            datetime(2010, 9, 11, 14, 30, 15),
        )
        self.assertEqual(next, datetime(2010, 9, 18, 14, 30))

    def test_not_weekday(self):
        next = self.next_ocurrance(
            self.crontab(minute=[5, 42], day_of_week='mon-fri'),
            datetime(2010, 9, 11, 14, 30, 15),
        )
        self.assertEqual(next, datetime(2010, 9, 13, 0, 5))

    def test_monthday(self):
        next = self.next_ocurrance(
            self.crontab(minute=30, hour=14, day_of_month=18),
            datetime(2010, 9, 11, 14, 30, 15),
        )
        self.assertEqual(next, datetime(2010, 9, 18, 14, 30))

    def test_not_monthday(self):
        next = self.next_ocurrance(
            self.crontab(minute=[5, 42], day_of_month=29),
            datetime(2010, 1, 22, 14, 30, 15),
        )
        self.assertEqual(next, datetime(2010, 1, 29, 0, 5))

    def test_weekday_monthday(self):
        next = self.next_ocurrance(
            self.crontab(minute=30, hour=14,
                         day_of_week='mon', day_of_month=18),
            datetime(2010, 1, 18, 14, 30, 15),
        )
        self.assertEqual(next, datetime(2010, 10, 18, 14, 30))

    def test_monthday_not_weekday(self):
        next = self.next_ocurrance(
            self.crontab(minute=[5, 42], day_of_week='sat', day_of_month=29),
            datetime(2010, 1, 29, 0, 5, 15),
        )
        self.assertEqual(next, datetime(2010, 5, 29, 0, 5))

    def test_weekday_not_monthday(self):
        next = self.next_ocurrance(
            self.crontab(minute=[5, 42], day_of_week='mon', day_of_month=18),
            datetime(2010, 1, 11, 0, 5, 15),
        )
        self.assertEqual(next, datetime(2010, 1, 18, 0, 5))

    def test_not_weekday_not_monthday(self):
        next = self.next_ocurrance(
            self.crontab(minute=[5, 42], day_of_week='mon', day_of_month=18),
            datetime(2010, 1, 10, 0, 5, 15),
        )
        self.assertEqual(next, datetime(2010, 1, 18, 0, 5))

    def test_leapday(self):
        next = self.next_ocurrance(
            self.crontab(minute=30, hour=14, day_of_month=29),
            datetime(2012, 1, 29, 14, 30, 15),
        )
        self.assertEqual(next, datetime(2012, 2, 29, 14, 30))

    def test_not_leapday(self):
        next = self.next_ocurrance(
            self.crontab(minute=30, hour=14, day_of_month=29),
            datetime(2010, 1, 29, 14, 30, 15),
        )
        self.assertEqual(next, datetime(2010, 3, 29, 14, 30))

    def test_weekmonthdayyear(self):
        next = self.next_ocurrance(
            self.crontab(minute=30, hour=14, day_of_week='fri',
                         day_of_month=29, month_of_year=1),
            datetime(2010, 1, 22, 14, 30, 15),
        )
        self.assertEqual(next, datetime(2010, 1, 29, 14, 30))

    def test_monthdayyear_not_week(self):
        next = self.next_ocurrance(
            self.crontab(minute=[5, 42], day_of_week='wed,thu',
                         day_of_month=29, month_of_year='1,4,7'),
            datetime(2010, 1, 29, 14, 30, 15),
        )
        self.assertEqual(next, datetime(2010, 4, 29, 0, 5))

    def test_weekdaymonthyear_not_monthday(self):
        next = self.next_ocurrance(
            self.crontab(minute=30, hour=14, day_of_week='fri',
                         day_of_month=29, month_of_year='1-10'),
            datetime(2010, 1, 29, 14, 30, 15),
        )
        self.assertEqual(next, datetime(2010, 10, 29, 14, 30))

    def test_weekmonthday_not_monthyear(self):
        next = self.next_ocurrance(
            self.crontab(minute=[5, 42], day_of_week='fri',
                         day_of_month=29, month_of_year='2-10'),
            datetime(2010, 1, 29, 14, 30, 15),
        )
        self.assertEqual(next, datetime(2010, 10, 29, 0, 5))

    def test_weekday_not_monthdayyear(self):
        next = self.next_ocurrance(
            self.crontab(minute=[5, 42], day_of_week='mon',
                         day_of_month=18, month_of_year='2-10'),
            datetime(2010, 1, 11, 0, 5, 15),
        )
        self.assertEqual(next, datetime(2010, 10, 18, 0, 5))

    def test_monthday_not_weekdaymonthyear(self):
        next = self.next_ocurrance(
            self.crontab(minute=[5, 42], day_of_week='mon',
                         day_of_month=29, month_of_year='2-4'),
            datetime(2010, 1, 29, 0, 5, 15),
        )
        self.assertEqual(next, datetime(2010, 3, 29, 0, 5))

    def test_monthyear_not_weekmonthday(self):
        next = self.next_ocurrance(
            self.crontab(minute=[5, 42], day_of_week='mon',
                         day_of_month=29, month_of_year='2-4'),
            datetime(2010, 2, 28, 0, 5, 15),
        )
        self.assertEqual(next, datetime(2010, 3, 29, 0, 5))

    def test_not_weekmonthdayyear(self):
        next = self.next_ocurrance(
            self.crontab(minute=[5, 42], day_of_week='fri,sat',
                         day_of_month=29, month_of_year='2-10'),
            datetime(2010, 1, 28, 14, 30, 15),
        )
        self.assertEqual(next, datetime(2010, 5, 29, 0, 5))


class test_crontab_is_due(AppCase):

    def getnow(self):
        return self.app.now()

    def setup(self):
        self.now = self.getnow()
        self.next_minute = 60 - self.now.second - 1e-6 * self.now.microsecond
        self.every_minute = self.crontab()
        self.quarterly = self.crontab(minute='*/15')
        self.hourly = self.crontab(minute=30)
        self.daily = self.crontab(hour=7, minute=30)
        self.weekly = self.crontab(hour=7, minute=30, day_of_week='thursday')
        self.monthly = self.crontab(
            hour=7, minute=30, day_of_week='thursday', day_of_month='8-14',
        )
        self.monthly_moy = self.crontab(
            hour=22, day_of_week='*', month_of_year='2',
            day_of_month='26,27,28',
        )
        self.yearly = self.crontab(
            hour=7, minute=30, day_of_week='thursday',
            day_of_month='8-14', month_of_year=3,
        )

    def crontab(self, *args, **kwargs):
        return crontab(*args, **dict(kwargs, app=self.app))

    def test_default_crontab_spec(self):
        c = self.crontab()
        self.assertEqual(c.minute, set(range(60)))
        self.assertEqual(c.hour, set(range(24)))
        self.assertEqual(c.day_of_week, set(range(7)))
        self.assertEqual(c.day_of_month, set(range(1, 32)))
        self.assertEqual(c.month_of_year, set(range(1, 13)))

    def test_simple_crontab_spec(self):
        c = self.crontab(minute=30)
        self.assertEqual(c.minute, set([30]))
        self.assertEqual(c.hour, set(range(24)))
        self.assertEqual(c.day_of_week, set(range(7)))
        self.assertEqual(c.day_of_month, set(range(1, 32)))
        self.assertEqual(c.month_of_year, set(range(1, 13)))

    def test_crontab_spec_minute_formats(self):
        c = self.crontab(minute=30)
        self.assertEqual(c.minute, set([30]))
        c = self.crontab(minute='30')
        self.assertEqual(c.minute, set([30]))
        c = self.crontab(minute=(30, 40, 50))
        self.assertEqual(c.minute, set([30, 40, 50]))
        c = self.crontab(minute=set([30, 40, 50]))
        self.assertEqual(c.minute, set([30, 40, 50]))

    def test_crontab_spec_invalid_minute(self):
        with self.assertRaises(ValueError):
            self.crontab(minute=60)
        with self.assertRaises(ValueError):
            self.crontab(minute='0-100')

    def test_crontab_spec_hour_formats(self):
        c = self.crontab(hour=6)
        self.assertEqual(c.hour, set([6]))
        c = self.crontab(hour='5')
        self.assertEqual(c.hour, set([5]))
        c = self.crontab(hour=(4, 8, 12))
        self.assertEqual(c.hour, set([4, 8, 12]))

    def test_crontab_spec_invalid_hour(self):
        with self.assertRaises(ValueError):
            self.crontab(hour=24)
        with self.assertRaises(ValueError):
            self.crontab(hour='0-30')

    def test_crontab_spec_dow_formats(self):
        c = self.crontab(day_of_week=5)
        self.assertEqual(c.day_of_week, set([5]))
        c = self.crontab(day_of_week='5')
        self.assertEqual(c.day_of_week, set([5]))
        c = self.crontab(day_of_week='fri')
        self.assertEqual(c.day_of_week, set([5]))
        c = self.crontab(day_of_week='tuesday,sunday,fri')
        self.assertEqual(c.day_of_week, set([0, 2, 5]))
        c = self.crontab(day_of_week='mon-fri')
        self.assertEqual(c.day_of_week, set([1, 2, 3, 4, 5]))
        c = self.crontab(day_of_week='*/2')
        self.assertEqual(c.day_of_week, set([0, 2, 4, 6]))

    def test_crontab_spec_invalid_dow(self):
        with self.assertRaises(ValueError):
            self.crontab(day_of_week='fooday-barday')
        with self.assertRaises(ValueError):
            self.crontab(day_of_week='1,4,foo')
        with self.assertRaises(ValueError):
            self.crontab(day_of_week='7')
        with self.assertRaises(ValueError):
            self.crontab(day_of_week='12')

    def test_crontab_spec_dom_formats(self):
        c = self.crontab(day_of_month=5)
        self.assertEqual(c.day_of_month, set([5]))
        c = self.crontab(day_of_month='5')
        self.assertEqual(c.day_of_month, set([5]))
        c = self.crontab(day_of_month='2,4,6')
        self.assertEqual(c.day_of_month, set([2, 4, 6]))
        c = self.crontab(day_of_month='*/5')
        self.assertEqual(c.day_of_month, set([1, 6, 11, 16, 21, 26, 31]))

    def test_crontab_spec_invalid_dom(self):
        with self.assertRaises(ValueError):
            self.crontab(day_of_month=0)
        with self.assertRaises(ValueError):
            self.crontab(day_of_month='0-10')
        with self.assertRaises(ValueError):
            self.crontab(day_of_month=32)
        with self.assertRaises(ValueError):
            self.crontab(day_of_month='31,32')

    def test_crontab_spec_moy_formats(self):
        c = self.crontab(month_of_year=1)
        self.assertEqual(c.month_of_year, set([1]))
        c = self.crontab(month_of_year='1')
        self.assertEqual(c.month_of_year, set([1]))
        c = self.crontab(month_of_year='2,4,6')
        self.assertEqual(c.month_of_year, set([2, 4, 6]))
        c = self.crontab(month_of_year='*/2')
        self.assertEqual(c.month_of_year, set([1, 3, 5, 7, 9, 11]))
        c = self.crontab(month_of_year='2-12/2')
        self.assertEqual(c.month_of_year, set([2, 4, 6, 8, 10, 12]))

    def test_crontab_spec_invalid_moy(self):
        with self.assertRaises(ValueError):
            self.crontab(month_of_year=0)
        with self.assertRaises(ValueError):
            self.crontab(month_of_year='0-5')
        with self.assertRaises(ValueError):
            self.crontab(month_of_year=13)
        with self.assertRaises(ValueError):
            self.crontab(month_of_year='12,13')

    def seconds_almost_equal(self, a, b, precision):
        for index, skew in enumerate((+0.1, 0, -0.1)):
            try:
                self.assertAlmostEqual(a, b + skew, precision)
            except AssertionError:
                if index + 1 >= 3:
                    raise
            else:
                break

    def assertRelativedelta(self, due, last_ran):
        try:
            from dateutil.relativedelta import relativedelta
        except ImportError:
            return
        l1, d1, n1 = due.remaining_delta(last_ran)
        l2, d2, n2 = due.remaining_delta(last_ran, ffwd=relativedelta)
        if not isinstance(d1, relativedelta):
            self.assertEqual(l1, l2)
            for field, value in items(d1._fields()):
                self.assertEqual(getattr(d1, field), value)
            self.assertFalse(d2.years)
            self.assertFalse(d2.months)
            self.assertFalse(d2.days)
            self.assertFalse(d2.leapdays)
            self.assertFalse(d2.hours)
            self.assertFalse(d2.minutes)
            self.assertFalse(d2.seconds)
            self.assertFalse(d2.microseconds)

    def test_every_minute_execution_is_due(self):
        last_ran = self.now - timedelta(seconds=61)
        due, remaining = self.every_minute.is_due(last_ran)
        self.assertRelativedelta(self.every_minute, last_ran)
        self.assertTrue(due)
        self.seconds_almost_equal(remaining, self.next_minute, 1)

    def test_every_minute_execution_is_not_due(self):
        last_ran = self.now - timedelta(seconds=self.now.second)
        due, remaining = self.every_minute.is_due(last_ran)
        self.assertFalse(due)
        self.seconds_almost_equal(remaining, self.next_minute, 1)

    def test_execution_is_due_on_saturday(self):
        # 29th of May 2010 is a saturday
        with patch_crontab_nowfun(self.hourly, datetime(2010, 5, 29, 10, 30)):
            last_ran = self.now - timedelta(seconds=61)
            due, remaining = self.every_minute.is_due(last_ran)
            self.assertTrue(due)
            self.seconds_almost_equal(remaining, self.next_minute, 1)

    def test_execution_is_due_on_sunday(self):
        # 30th of May 2010 is a sunday
        with patch_crontab_nowfun(self.hourly, datetime(2010, 5, 30, 10, 30)):
            last_ran = self.now - timedelta(seconds=61)
            due, remaining = self.every_minute.is_due(last_ran)
            self.assertTrue(due)
            self.seconds_almost_equal(remaining, self.next_minute, 1)

    def test_execution_is_due_on_monday(self):
        # 31st of May 2010 is a monday
        with patch_crontab_nowfun(self.hourly, datetime(2010, 5, 31, 10, 30)):
            last_ran = self.now - timedelta(seconds=61)
            due, remaining = self.every_minute.is_due(last_ran)
            self.assertTrue(due)
            self.seconds_almost_equal(remaining, self.next_minute, 1)

    def test_every_hour_execution_is_due(self):
        with patch_crontab_nowfun(self.hourly, datetime(2010, 5, 10, 10, 30)):
            due, remaining = self.hourly.is_due(datetime(2010, 5, 10, 6, 30))
            self.assertTrue(due)
            self.assertEqual(remaining, 60 * 60)

    def test_every_hour_execution_is_not_due(self):
        with patch_crontab_nowfun(self.hourly, datetime(2010, 5, 10, 10, 29)):
            due, remaining = self.hourly.is_due(datetime(2010, 5, 10, 9, 30))
            self.assertFalse(due)
            self.assertEqual(remaining, 60)

    def test_first_quarter_execution_is_due(self):
        with patch_crontab_nowfun(
                self.quarterly, datetime(2010, 5, 10, 10, 15)):
            due, remaining = self.quarterly.is_due(
                datetime(2010, 5, 10, 6, 30),
            )
            self.assertTrue(due)
            self.assertEqual(remaining, 15 * 60)

    def test_second_quarter_execution_is_due(self):
        with patch_crontab_nowfun(
                self.quarterly, datetime(2010, 5, 10, 10, 30)):
            due, remaining = self.quarterly.is_due(
                datetime(2010, 5, 10, 6, 30),
            )
            self.assertTrue(due)
            self.assertEqual(remaining, 15 * 60)

    def test_first_quarter_execution_is_not_due(self):
        with patch_crontab_nowfun(
                self.quarterly, datetime(2010, 5, 10, 10, 14)):
            due, remaining = self.quarterly.is_due(
                datetime(2010, 5, 10, 10, 0),
            )
            self.assertFalse(due)
            self.assertEqual(remaining, 60)

    def test_second_quarter_execution_is_not_due(self):
        with patch_crontab_nowfun(
                self.quarterly, datetime(2010, 5, 10, 10, 29)):
            due, remaining = self.quarterly.is_due(
                datetime(2010, 5, 10, 10, 15),
            )
            self.assertFalse(due)
            self.assertEqual(remaining, 60)

    def test_daily_execution_is_due(self):
        with patch_crontab_nowfun(self.daily, datetime(2010, 5, 10, 7, 30)):
            due, remaining = self.daily.is_due(datetime(2010, 5, 9, 7, 30))
            self.assertTrue(due)
            self.assertEqual(remaining, 24 * 60 * 60)

    def test_daily_execution_is_not_due(self):
        with patch_crontab_nowfun(self.daily, datetime(2010, 5, 10, 10, 30)):
            due, remaining = self.daily.is_due(datetime(2010, 5, 10, 7, 30))
            self.assertFalse(due)
            self.assertEqual(remaining, 21 * 60 * 60)

    def test_weekly_execution_is_due(self):
        with patch_crontab_nowfun(self.weekly, datetime(2010, 5, 6, 7, 30)):
            due, remaining = self.weekly.is_due(datetime(2010, 4, 30, 7, 30))
            self.assertTrue(due)
            self.assertEqual(remaining, 7 * 24 * 60 * 60)

    def test_weekly_execution_is_not_due(self):
        with patch_crontab_nowfun(self.weekly, datetime(2010, 5, 7, 10, 30)):
            due, remaining = self.weekly.is_due(datetime(2010, 5, 6, 7, 30))
            self.assertFalse(due)
            self.assertEqual(remaining, 6 * 24 * 60 * 60 - 3 * 60 * 60)

    def test_monthly_execution_is_due(self):
        with patch_crontab_nowfun(self.monthly, datetime(2010, 5, 13, 7, 30)):
            due, remaining = self.monthly.is_due(datetime(2010, 4, 8, 7, 30))
            self.assertTrue(due)
            self.assertEqual(remaining, 28 * 24 * 60 * 60)

    def test_monthly_execution_is_not_due(self):
        with patch_crontab_nowfun(self.monthly, datetime(2010, 5, 9, 10, 30)):
            due, remaining = self.monthly.is_due(datetime(2010, 4, 8, 7, 30))
            self.assertFalse(due)
            self.assertEqual(remaining, 4 * 24 * 60 * 60 - 3 * 60 * 60)

    def test_monthly_moy_execution_is_due(self):
        with patch_crontab_nowfun(
                self.monthly_moy, datetime(2014, 2, 26, 22, 0)):
            due, remaining = self.monthly_moy.is_due(
                datetime(2013, 7, 4, 10, 0),
            )
            self.assertTrue(due)
            self.assertEqual(remaining, 60.)

    def test_monthly_moy_execution_is_not_due(self):
        raise SkipTest('unstable test')
        with patch_crontab_nowfun(
                self.monthly_moy, datetime(2013, 6, 28, 14, 30)):
            due, remaining = self.monthly_moy.is_due(
                datetime(2013, 6, 28, 22, 14),
            )
            self.assertFalse(due)
            attempt = (
                time.mktime(datetime(2014, 2, 26, 22, 0).timetuple()) -
                time.mktime(datetime(2013, 6, 28, 14, 30).timetuple()) -
                60 * 60
            )
            self.assertEqual(remaining, attempt)

    def test_monthly_moy_execution_is_due2(self):
        with patch_crontab_nowfun(
                self.monthly_moy, datetime(2014, 2, 26, 22, 0)):
            due, remaining = self.monthly_moy.is_due(
                datetime(2013, 2, 28, 10, 0),
            )
            self.assertTrue(due)
            self.assertEqual(remaining, 60.)

    def test_monthly_moy_execution_is_not_due2(self):
        with patch_crontab_nowfun(
                self.monthly_moy, datetime(2014, 2, 26, 21, 0)):
            due, remaining = self.monthly_moy.is_due(
                datetime(2013, 6, 28, 22, 14),
            )
            self.assertFalse(due)
            attempt = 60 * 60
            self.assertEqual(remaining, attempt)

    def test_yearly_execution_is_due(self):
        with patch_crontab_nowfun(self.yearly, datetime(2010, 3, 11, 7, 30)):
            due, remaining = self.yearly.is_due(datetime(2009, 3, 12, 7, 30))
            self.assertTrue(due)
            self.assertEqual(remaining, 364 * 24 * 60 * 60)

    def test_yearly_execution_is_not_due(self):
        with patch_crontab_nowfun(self.yearly, datetime(2010, 3, 7, 10, 30)):
            due, remaining = self.yearly.is_due(datetime(2009, 3, 12, 7, 30))
            self.assertFalse(due)
            self.assertEqual(remaining, 4 * 24 * 60 * 60 - 3 * 60 * 60)
