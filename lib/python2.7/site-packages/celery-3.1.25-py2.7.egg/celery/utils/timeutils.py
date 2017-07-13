# -*- coding: utf-8 -*-
"""
    celery.utils.timeutils
    ~~~~~~~~~~~~~~~~~~~~~~

    This module contains various utilities related to dates and times.

"""
from __future__ import absolute_import

import numbers
import os
import sys
import time as _time

from calendar import monthrange
from datetime import date, datetime, timedelta, tzinfo

from kombu.utils import cached_property, reprcall
from kombu.utils.compat import timedelta_seconds

from pytz import timezone as _timezone, AmbiguousTimeError, FixedOffset

from celery.five import string_t

from .functional import dictfilter
from .iso8601 import parse_iso8601
from .text import pluralize

__all__ = ['LocalTimezone', 'timezone', 'maybe_timedelta', 'timedelta_seconds',
           'delta_resolution', 'remaining', 'rate', 'weekday',
           'humanize_seconds', 'maybe_iso8601', 'is_naive', 'make_aware',
           'localize', 'to_utc', 'maybe_make_aware', 'ffwd', 'utcoffset',
           'adjust_timestamp', 'maybe_s_to_ms']

PY3 = sys.version_info[0] == 3
PY33 = sys.version_info >= (3, 3)

C_REMDEBUG = os.environ.get('C_REMDEBUG', False)

DAYNAMES = 'sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'
WEEKDAYS = dict(zip(DAYNAMES, range(7)))

RATE_MODIFIER_MAP = {'s': lambda n: n,
                     'm': lambda n: n / 60.0,
                     'h': lambda n: n / 60.0 / 60.0}

TIME_UNITS = (('day', 60 * 60 * 24.0, lambda n: format(n, '.2f')),
              ('hour', 60 * 60.0, lambda n: format(n, '.2f')),
              ('minute', 60.0, lambda n: format(n, '.2f')),
              ('second', 1.0, lambda n: format(n, '.2f')))

ZERO = timedelta(0)

_local_timezone = None


class LocalTimezone(tzinfo):
    """Local time implementation taken from Python's docs.

    Used only when UTC is not enabled.
    """
    _offset_cache = {}

    def __init__(self):
        # This code is moved in __init__ to execute it as late as possible
        # See get_default_timezone().
        self.STDOFFSET = timedelta(seconds=-_time.timezone)
        if _time.daylight:
            self.DSTOFFSET = timedelta(seconds=-_time.altzone)
        else:
            self.DSTOFFSET = self.STDOFFSET
        self.DSTDIFF = self.DSTOFFSET - self.STDOFFSET
        tzinfo.__init__(self)

    def __repr__(self):
        return '<LocalTimezone: UTC{0:+03d}>'.format(
            int(timedelta_seconds(self.DSTOFFSET) / 3600),
        )

    def utcoffset(self, dt):
        return self.DSTOFFSET if self._isdst(dt) else self.STDOFFSET

    def dst(self, dt):
        return self.DSTDIFF if self._isdst(dt) else ZERO

    def tzname(self, dt):
        return _time.tzname[self._isdst(dt)]

    if PY3:

        def fromutc(self, dt):
            # The base tzinfo class no longer implements a DST
            # offset aware .fromutc() in Python3 (Issue #2306).

            # I'd rather rely on pytz to do this, than port
            # the C code from cpython's fromutc [asksol]
            offset = int(self.utcoffset(dt).seconds / 60.0)
            try:
                tz = self._offset_cache[offset]
            except KeyError:
                tz = self._offset_cache[offset] = FixedOffset(offset)
            return tz.fromutc(dt.replace(tzinfo=tz))

    def _isdst(self, dt):
        tt = (dt.year, dt.month, dt.day,
              dt.hour, dt.minute, dt.second,
              dt.weekday(), 0, 0)
        stamp = _time.mktime(tt)
        tt = _time.localtime(stamp)
        return tt.tm_isdst > 0


class _Zone(object):

    def tz_or_local(self, tzinfo=None):
        if tzinfo is None:
            return self.local
        return self.get_timezone(tzinfo)

    def to_local(self, dt, local=None, orig=None):
        if is_naive(dt):
            dt = make_aware(dt, orig or self.utc)
        return localize(dt, self.tz_or_local(local))

    if PY33:

        def to_system(self, dt):
            # tz=None is a special case since Python 3.3, and will
            # convert to the current local timezone (Issue #2306).
            return dt.astimezone(tz=None)

    else:

        def to_system(self, dt):  # noqa
            return localize(dt, self.local)

    def to_local_fallback(self, dt):
        if is_naive(dt):
            return make_aware(dt, self.local)
        return localize(dt, self.local)

    def get_timezone(self, zone):
        if isinstance(zone, string_t):
            return _timezone(zone)
        return zone

    @cached_property
    def local(self):
        return LocalTimezone()

    @cached_property
    def utc(self):
        return self.get_timezone('UTC')
timezone = _Zone()


def maybe_timedelta(delta):
    """Coerces integer to timedelta if `delta` is an integer."""
    if isinstance(delta, numbers.Real):
        return timedelta(seconds=delta)
    return delta


def delta_resolution(dt, delta):
    """Round a datetime to the resolution of a timedelta.

    If the timedelta is in days, the datetime will be rounded
    to the nearest days, if the timedelta is in hours the datetime
    will be rounded to the nearest hour, and so on until seconds
    which will just return the original datetime.

    """
    delta = timedelta_seconds(delta)

    resolutions = ((3, lambda x: x / 86400),
                   (4, lambda x: x / 3600),
                   (5, lambda x: x / 60))

    args = dt.year, dt.month, dt.day, dt.hour, dt.minute, dt.second
    for res, predicate in resolutions:
        if predicate(delta) >= 1.0:
            return datetime(*args[:res], tzinfo=dt.tzinfo)
    return dt


def remaining(start, ends_in, now=None, relative=False):
    """Calculate the remaining time for a start date and a timedelta.

    e.g. "how many seconds left for 30 seconds after start?"

    :param start: Start :class:`~datetime.datetime`.
    :param ends_in: The end delta as a :class:`~datetime.timedelta`.
    :keyword relative: If enabled the end time will be
        calculated using :func:`delta_resolution` (i.e. rounded to the
        resolution of `ends_in`).
    :keyword now: Function returning the current time and date,
        defaults to :func:`datetime.utcnow`.

    """
    now = now or datetime.utcnow()
    end_date = start + ends_in
    if relative:
        end_date = delta_resolution(end_date, ends_in)
    ret = end_date - now
    if C_REMDEBUG:  # pragma: no cover
        print('rem: NOW:%r START:%r ENDS_IN:%r END_DATE:%s REM:%s' % (
            now, start, ends_in, end_date, ret))
    return ret


def rate(rate):
    """Parse rate strings, such as `"100/m"`, `"2/h"` or `"0.5/s"`
    and convert them to seconds."""
    if rate:
        if isinstance(rate, string_t):
            ops, _, modifier = rate.partition('/')
            return RATE_MODIFIER_MAP[modifier or 's'](float(ops)) or 0
        return rate or 0
    return 0


def weekday(name):
    """Return the position of a weekday (0 - 7, where 0 is Sunday).

    Example::

        >>> weekday('sunday'), weekday('sun'), weekday('mon')
        (0, 0, 1)

    """
    abbreviation = name[0:3].lower()
    try:
        return WEEKDAYS[abbreviation]
    except KeyError:
        # Show original day name in exception, instead of abbr.
        raise KeyError(name)


def humanize_seconds(secs, prefix='', sep='', now='now'):
    """Show seconds in human form, e.g. 60 is "1 minute", 7200 is "2
    hours".

    :keyword prefix: Can be used to add a preposition to the output,
        e.g. 'in' will give 'in 1 second', but add nothing to 'now'.

    """
    secs = float(secs)
    for unit, divider, formatter in TIME_UNITS:
        if secs >= divider:
            w = secs / divider
            return '{0}{1}{2} {3}'.format(prefix, sep, formatter(w),
                                          pluralize(w, unit))
    return now


def maybe_iso8601(dt):
    """`Either datetime | str -> datetime or None -> None`"""
    if not dt:
        return
    if isinstance(dt, datetime):
        return dt
    return parse_iso8601(dt)


def is_naive(dt):
    """Return :const:`True` if the datetime is naive
    (does not have timezone information)."""
    return dt.tzinfo is None or dt.tzinfo.utcoffset(dt) is None


def make_aware(dt, tz):
    """Sets the timezone for a datetime object."""
    try:
        _localize = tz.localize
    except AttributeError:
        return dt.replace(tzinfo=tz)
    else:
        # works on pytz timezones
        try:
            return _localize(dt, is_dst=None)
        except AmbiguousTimeError:
            return min(_localize(dt, is_dst=True),
                       _localize(dt, is_dst=False))


def localize(dt, tz):
    """Convert aware datetime to another timezone."""
    dt = dt.astimezone(tz)
    try:
        _normalize = tz.normalize
    except AttributeError:  # non-pytz tz
        return dt
    else:
        try:
            return _normalize(dt, is_dst=None)
        except TypeError:
            return _normalize(dt)
        except AmbiguousTimeError:
            return min(_normalize(dt, is_dst=True),
                       _normalize(dt, is_dst=False))


def to_utc(dt):
    """Converts naive datetime to UTC"""
    return make_aware(dt, timezone.utc)


def maybe_make_aware(dt, tz=None):
    if is_naive(dt):
        dt = to_utc(dt)
    return localize(
        dt, timezone.utc if tz is None else timezone.tz_or_local(tz),
    )


class ffwd(object):
    """Version of relativedelta that only supports addition."""

    def __init__(self, year=None, month=None, weeks=0, weekday=None, day=None,
                 hour=None, minute=None, second=None, microsecond=None,
                 **kwargs):
        self.year = year
        self.month = month
        self.weeks = weeks
        self.weekday = weekday
        self.day = day
        self.hour = hour
        self.minute = minute
        self.second = second
        self.microsecond = microsecond
        self.days = weeks * 7
        self._has_time = self.hour is not None or self.minute is not None

    def __repr__(self):
        return reprcall('ffwd', (), self._fields(weeks=self.weeks,
                                                 weekday=self.weekday))

    def __radd__(self, other):
        if not isinstance(other, date):
            return NotImplemented
        year = self.year or other.year
        month = self.month or other.month
        day = min(monthrange(year, month)[1], self.day or other.day)
        ret = other.replace(**dict(dictfilter(self._fields()),
                            year=year, month=month, day=day))
        if self.weekday is not None:
            ret += timedelta(days=(7 - ret.weekday() + self.weekday) % 7)
        return ret + timedelta(days=self.days)

    def _fields(self, **extra):
        return dictfilter({
            'year': self.year, 'month': self.month, 'day': self.day,
            'hour': self.hour, 'minute': self.minute,
            'second': self.second, 'microsecond': self.microsecond,
        }, **extra)


def utcoffset(time=_time, localtime=_time.localtime):
    if localtime().tm_isdst:
        return time.altzone // 3600
    return time.timezone // 3600


def adjust_timestamp(ts, offset, here=utcoffset):
    return ts - (offset - here()) * 3600


def maybe_s_to_ms(v):
    return int(float(v) * 1000.0) if v is not None else v
