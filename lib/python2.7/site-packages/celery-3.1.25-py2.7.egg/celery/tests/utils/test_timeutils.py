from __future__ import absolute_import

import pytz

from datetime import datetime, timedelta, tzinfo
from pytz import AmbiguousTimeError

from celery.utils.timeutils import (
    delta_resolution,
    humanize_seconds,
    maybe_iso8601,
    maybe_timedelta,
    timedelta_seconds,
    timezone,
    rate,
    remaining,
    make_aware,
    maybe_make_aware,
    localize,
    LocalTimezone,
    ffwd,
    utcoffset,
)
from celery.utils.iso8601 import parse_iso8601
from celery.tests.case import Case, Mock, patch


class test_LocalTimezone(Case):

    def test_daylight(self):
        with patch('celery.utils.timeutils._time') as time:
            time.timezone = 3600
            time.daylight = False
            x = LocalTimezone()
            self.assertEqual(x.STDOFFSET, timedelta(seconds=-3600))
            self.assertEqual(x.DSTOFFSET, x.STDOFFSET)
            time.daylight = True
            time.altzone = 3600
            y = LocalTimezone()
            self.assertEqual(y.STDOFFSET, timedelta(seconds=-3600))
            self.assertEqual(y.DSTOFFSET, timedelta(seconds=-3600))

            self.assertTrue(repr(y))

            y._isdst = Mock()
            y._isdst.return_value = True
            self.assertTrue(y.utcoffset(datetime.now()))
            self.assertFalse(y.dst(datetime.now()))
            y._isdst.return_value = False
            self.assertTrue(y.utcoffset(datetime.now()))
            self.assertFalse(y.dst(datetime.now()))

            self.assertTrue(y.tzname(datetime.now()))


class test_iso8601(Case):

    def test_parse_with_timezone(self):
        d = datetime.utcnow().replace(tzinfo=pytz.utc)
        self.assertEqual(parse_iso8601(d.isoformat()), d)
        # 2013-06-07T20:12:51.775877+00:00
        iso = d.isoformat()
        iso1 = iso.replace('+00:00', '-01:00')
        d1 = parse_iso8601(iso1)
        self.assertEqual(d1.tzinfo._minutes, -60)
        iso2 = iso.replace('+00:00', '+01:00')
        d2 = parse_iso8601(iso2)
        self.assertEqual(d2.tzinfo._minutes, +60)
        iso3 = iso.replace('+00:00', 'Z')
        d3 = parse_iso8601(iso3)
        self.assertEqual(d3.tzinfo, pytz.UTC)


class test_timeutils(Case):

    def test_delta_resolution(self):
        D = delta_resolution
        dt = datetime(2010, 3, 30, 11, 50, 58, 41065)
        deltamap = ((timedelta(days=2), datetime(2010, 3, 30, 0, 0)),
                    (timedelta(hours=2), datetime(2010, 3, 30, 11, 0)),
                    (timedelta(minutes=2), datetime(2010, 3, 30, 11, 50)),
                    (timedelta(seconds=2), dt))
        for delta, shoulda in deltamap:
            self.assertEqual(D(dt, delta), shoulda)

    def test_timedelta_seconds(self):
        deltamap = ((timedelta(seconds=1), 1),
                    (timedelta(seconds=27), 27),
                    (timedelta(minutes=3), 3 * 60),
                    (timedelta(hours=4), 4 * 60 * 60),
                    (timedelta(days=3), 3 * 86400))
        for delta, seconds in deltamap:
            self.assertEqual(timedelta_seconds(delta), seconds)

    def test_timedelta_seconds_returns_0_on_negative_time(self):
        delta = timedelta(days=-2)
        self.assertEqual(timedelta_seconds(delta), 0)

    def test_humanize_seconds(self):
        t = ((4 * 60 * 60 * 24, '4.00 days'),
             (1 * 60 * 60 * 24, '1.00 day'),
             (4 * 60 * 60, '4.00 hours'),
             (1 * 60 * 60, '1.00 hour'),
             (4 * 60, '4.00 minutes'),
             (1 * 60, '1.00 minute'),
             (4, '4.00 seconds'),
             (1, '1.00 second'),
             (4.3567631221, '4.36 seconds'),
             (0, 'now'))

        for seconds, human in t:
            self.assertEqual(humanize_seconds(seconds), human)

        self.assertEqual(humanize_seconds(4, prefix='about '),
                         'about 4.00 seconds')

    def test_maybe_iso8601_datetime(self):
        now = datetime.now()
        self.assertIs(maybe_iso8601(now), now)

    def test_maybe_timedelta(self):
        D = maybe_timedelta

        for i in (30, 30.6):
            self.assertEqual(D(i), timedelta(seconds=i))

        self.assertEqual(D(timedelta(days=2)), timedelta(days=2))

    def test_remaining_relative(self):
        remaining(datetime.utcnow(), timedelta(hours=1), relative=True)


class test_timezone(Case):

    def test_get_timezone_with_pytz(self):
        self.assertTrue(timezone.get_timezone('UTC'))

    def test_tz_or_local(self):
        self.assertEqual(timezone.tz_or_local(), timezone.local)
        self.assertTrue(timezone.tz_or_local(timezone.utc))

    def test_to_local(self):
        self.assertTrue(
            timezone.to_local(make_aware(datetime.utcnow(), timezone.utc)),
        )
        self.assertTrue(
            timezone.to_local(datetime.utcnow())
        )

    def test_to_local_fallback(self):
        self.assertTrue(
            timezone.to_local_fallback(
                make_aware(datetime.utcnow(), timezone.utc)),
        )
        self.assertTrue(
            timezone.to_local_fallback(datetime.utcnow())
        )


class test_make_aware(Case):

    def test_tz_without_localize(self):
        tz = tzinfo()
        self.assertFalse(hasattr(tz, 'localize'))
        wtz = make_aware(datetime.utcnow(), tz)
        self.assertEqual(wtz.tzinfo, tz)

    def test_when_has_localize(self):

        class tzz(tzinfo):
            raises = False

            def localize(self, dt, is_dst=None):
                self.localized = True
                if self.raises and is_dst is None:
                    self.raised = True
                    raise AmbiguousTimeError()
                return 1  # needed by min() in Python 3 (None not hashable)

        tz = tzz()
        make_aware(datetime.utcnow(), tz)
        self.assertTrue(tz.localized)

        tz2 = tzz()
        tz2.raises = True
        make_aware(datetime.utcnow(), tz2)
        self.assertTrue(tz2.localized)
        self.assertTrue(tz2.raised)

    def test_maybe_make_aware(self):
        aware = datetime.utcnow().replace(tzinfo=timezone.utc)
        self.assertTrue(maybe_make_aware(aware), timezone.utc)
        naive = datetime.utcnow()
        self.assertTrue(maybe_make_aware(naive))


class test_localize(Case):

    def test_tz_without_normalize(self):
        tz = tzinfo()
        self.assertFalse(hasattr(tz, 'normalize'))
        self.assertTrue(localize(make_aware(datetime.utcnow(), tz), tz))

    def test_when_has_normalize(self):

        class tzz(tzinfo):
            raises = None

            def normalize(self, dt, **kwargs):
                self.normalized = True
                if self.raises and kwargs and kwargs.get('is_dst') is None:
                    self.raised = True
                    raise self.raises
                return 1  # needed by min() in Python 3 (None not hashable)

        tz = tzz()
        localize(make_aware(datetime.utcnow(), tz), tz)
        self.assertTrue(tz.normalized)

        tz2 = tzz()
        tz2.raises = AmbiguousTimeError()
        localize(make_aware(datetime.utcnow(), tz2), tz2)
        self.assertTrue(tz2.normalized)
        self.assertTrue(tz2.raised)

        tz3 = tzz()
        tz3.raises = TypeError()
        localize(make_aware(datetime.utcnow(), tz3), tz3)
        self.assertTrue(tz3.normalized)
        self.assertTrue(tz3.raised)


class test_rate_limit_string(Case):

    def test_conversion(self):
        self.assertEqual(rate(999), 999)
        self.assertEqual(rate(7.5), 7.5)
        self.assertEqual(rate('2.5/s'), 2.5)
        self.assertEqual(rate('1456/s'), 1456)
        self.assertEqual(rate('100/m'),
                         100 / 60.0)
        self.assertEqual(rate('10/h'),
                         10 / 60.0 / 60.0)

        for zero in (0, None, '0', '0/m', '0/h', '0/s', '0.0/s'):
            self.assertEqual(rate(zero), 0)


class test_ffwd(Case):

    def test_repr(self):
        x = ffwd(year=2012)
        self.assertTrue(repr(x))

    def test_radd_with_unknown_gives_NotImplemented(self):
        x = ffwd(year=2012)
        self.assertEqual(x.__radd__(object()), NotImplemented)


class test_utcoffset(Case):

    def test_utcoffset(self):
        with patch('celery.utils.timeutils._time') as _time:
            _time.daylight = True
            self.assertIsNotNone(utcoffset())
            _time.daylight = False
            self.assertIsNotNone(utcoffset())
