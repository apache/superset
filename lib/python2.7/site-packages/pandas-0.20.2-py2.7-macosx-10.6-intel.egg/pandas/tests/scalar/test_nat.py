import pytest

from datetime import datetime, timedelta
import pytz

import numpy as np
from pandas import (NaT, Index, Timestamp, Timedelta, Period,
                    DatetimeIndex, PeriodIndex,
                    TimedeltaIndex, Series, isnull)
from pandas.util import testing as tm
from pandas._libs.tslib import iNaT


@pytest.mark.parametrize('nat, idx', [(Timestamp('NaT'), DatetimeIndex),
                                      (Timedelta('NaT'), TimedeltaIndex),
                                      (Period('NaT', freq='M'), PeriodIndex)])
def test_nat_fields(nat, idx):

    for field in idx._field_ops:

        # weekday is a property of DTI, but a method
        # on NaT/Timestamp for compat with datetime
        if field == 'weekday':
            continue

        result = getattr(NaT, field)
        assert np.isnan(result)

        result = getattr(nat, field)
        assert np.isnan(result)

    for field in idx._bool_ops:

        result = getattr(NaT, field)
        assert result is False

        result = getattr(nat, field)
        assert result is False


def test_nat_vector_field_access():
    idx = DatetimeIndex(['1/1/2000', None, None, '1/4/2000'])

    for field in DatetimeIndex._field_ops:
        # weekday is a property of DTI, but a method
        # on NaT/Timestamp for compat with datetime
        if field == 'weekday':
            continue

        result = getattr(idx, field)
        expected = Index([getattr(x, field) for x in idx])
        tm.assert_index_equal(result, expected)

    s = Series(idx)

    for field in DatetimeIndex._field_ops:

        # weekday is a property of DTI, but a method
        # on NaT/Timestamp for compat with datetime
        if field == 'weekday':
            continue

        result = getattr(s.dt, field)
        expected = [getattr(x, field) for x in idx]
        tm.assert_series_equal(result, Series(expected))

    for field in DatetimeIndex._bool_ops:
        result = getattr(s.dt, field)
        expected = [getattr(x, field) for x in idx]
        tm.assert_series_equal(result, Series(expected))


@pytest.mark.parametrize('klass', [Timestamp, Timedelta, Period])
def test_identity(klass):
    assert klass(None) is NaT

    result = klass(np.nan)
    assert result is NaT

    result = klass(None)
    assert result is NaT

    result = klass(iNaT)
    assert result is NaT

    result = klass(np.nan)
    assert result is NaT

    result = klass(float('nan'))
    assert result is NaT

    result = klass(NaT)
    assert result is NaT

    result = klass('NaT')
    assert result is NaT

    assert isnull(klass('nat'))


@pytest.mark.parametrize('klass', [Timestamp, Timedelta, Period])
def test_equality(klass):

    # nat
    if klass is not Period:
        klass('').value == iNaT
    klass('nat').value == iNaT
    klass('NAT').value == iNaT
    klass(None).value == iNaT
    klass(np.nan).value == iNaT
    assert isnull(klass('nat'))


@pytest.mark.parametrize('klass', [Timestamp, Timedelta])
def test_round_nat(klass):
    # GH14940
    ts = klass('nat')
    for method in ["round", "floor", "ceil"]:
        round_method = getattr(ts, method)
        for freq in ["s", "5s", "min", "5min", "h", "5h"]:
            assert round_method(freq) is ts


def test_NaT_methods():
    # GH 9513
    raise_methods = ['astimezone', 'combine', 'ctime', 'dst',
                     'fromordinal', 'fromtimestamp', 'isocalendar',
                     'strftime', 'strptime', 'time', 'timestamp',
                     'timetuple', 'timetz', 'toordinal', 'tzname',
                     'utcfromtimestamp', 'utcnow', 'utcoffset',
                     'utctimetuple']
    nat_methods = ['date', 'now', 'replace', 'to_datetime', 'today',
                   'tz_convert', 'tz_localize']
    nan_methods = ['weekday', 'isoweekday']

    for method in raise_methods:
        if hasattr(NaT, method):
            with pytest.raises(ValueError):
                getattr(NaT, method)()

    for method in nan_methods:
        if hasattr(NaT, method):
            assert np.isnan(getattr(NaT, method)())

    for method in nat_methods:
        if hasattr(NaT, method):
            # see gh-8254
            exp_warning = None
            if method == 'to_datetime':
                exp_warning = FutureWarning
            with tm.assert_produces_warning(
                    exp_warning, check_stacklevel=False):
                assert getattr(NaT, method)() is NaT

    # GH 12300
    assert NaT.isoformat() == 'NaT'


@pytest.mark.parametrize('klass', [Timestamp, Timedelta])
def test_isoformat(klass):

    result = klass('NaT').isoformat()
    expected = 'NaT'
    assert result == expected


def test_nat_arithmetic():
    # GH 6873
    i = 2
    f = 1.5

    for (left, right) in [(NaT, i), (NaT, f), (NaT, np.nan)]:
        assert left / right is NaT
        assert left * right is NaT
        assert right * left is NaT
        with pytest.raises(TypeError):
            right / left

    # Timestamp / datetime
    t = Timestamp('2014-01-01')
    dt = datetime(2014, 1, 1)
    for (left, right) in [(NaT, NaT), (NaT, t), (NaT, dt)]:
        # NaT __add__ or __sub__ Timestamp-like (or inverse) returns NaT
        assert right + left is NaT
        assert left + right is NaT
        assert left - right is NaT
        assert right - left is NaT

    # timedelta-like
    # offsets are tested in test_offsets.py

    delta = timedelta(3600)
    td = Timedelta('5s')

    for (left, right) in [(NaT, delta), (NaT, td)]:
        # NaT + timedelta-like returns NaT
        assert right + left is NaT
        assert left + right is NaT
        assert right - left is NaT
        assert left - right is NaT

    # GH 11718
    t_utc = Timestamp('2014-01-01', tz='UTC')
    t_tz = Timestamp('2014-01-01', tz='US/Eastern')
    dt_tz = pytz.timezone('Asia/Tokyo').localize(dt)

    for (left, right) in [(NaT, t_utc), (NaT, t_tz),
                          (NaT, dt_tz)]:
        # NaT __add__ or __sub__ Timestamp-like (or inverse) returns NaT
        assert right + left is NaT
        assert left + right is NaT
        assert left - right is NaT
        assert right - left is NaT

    # int addition / subtraction
    for (left, right) in [(NaT, 2), (NaT, 0), (NaT, -3)]:
        assert right + left is NaT
        assert left + right is NaT
        assert left - right is NaT
        assert right - left is NaT


def test_nat_arithmetic_index():
    # GH 11718

    dti = DatetimeIndex(['2011-01-01', '2011-01-02'], name='x')
    exp = DatetimeIndex([NaT, NaT], name='x')
    tm.assert_index_equal(dti + NaT, exp)
    tm.assert_index_equal(NaT + dti, exp)

    dti_tz = DatetimeIndex(['2011-01-01', '2011-01-02'],
                           tz='US/Eastern', name='x')
    exp = DatetimeIndex([NaT, NaT], name='x', tz='US/Eastern')
    tm.assert_index_equal(dti_tz + NaT, exp)
    tm.assert_index_equal(NaT + dti_tz, exp)

    exp = TimedeltaIndex([NaT, NaT], name='x')
    for (left, right) in [(NaT, dti), (NaT, dti_tz)]:
        tm.assert_index_equal(left - right, exp)
        tm.assert_index_equal(right - left, exp)

    # timedelta
    tdi = TimedeltaIndex(['1 day', '2 day'], name='x')
    exp = DatetimeIndex([NaT, NaT], name='x')
    for (left, right) in [(NaT, tdi)]:
        tm.assert_index_equal(left + right, exp)
        tm.assert_index_equal(right + left, exp)
        tm.assert_index_equal(left - right, exp)
        tm.assert_index_equal(right - left, exp)
