# pylint: disable=E1101,E1103,W0232
from datetime import datetime, timedelta
import numpy as np
import warnings


from pandas.core import common as com
from pandas.core.dtypes.common import (
    is_integer,
    is_float,
    is_object_dtype,
    is_integer_dtype,
    is_float_dtype,
    is_scalar,
    is_datetime64_dtype,
    is_datetime64tz_dtype,
    is_timedelta64_dtype,
    is_period_dtype,
    is_bool_dtype,
    pandas_dtype,
    _ensure_object)
from pandas.core.dtypes.dtypes import PeriodDtype
from pandas.core.dtypes.generic import ABCSeries

import pandas.tseries.frequencies as frequencies
from pandas.tseries.frequencies import get_freq_code as _gfc
from pandas.core.indexes.datetimes import DatetimeIndex, Int64Index, Index
from pandas.core.indexes.timedeltas import TimedeltaIndex
from pandas.core.indexes.datetimelike import DatelikeOps, DatetimeIndexOpsMixin
from pandas.core.tools.datetimes import parse_time_string
import pandas.tseries.offsets as offsets

from pandas._libs.lib import infer_dtype
from pandas._libs import tslib, period
from pandas._libs.period import (Period, IncompatibleFrequency,
                                 get_period_field_arr, _validate_end_alias,
                                 _quarter_to_myear)

from pandas.core.base import _shared_docs
from pandas.core.indexes.base import _index_shared_docs, _ensure_index

from pandas import compat
from pandas.util._decorators import (Appender, Substitution, cache_readonly,
                                     deprecate_kwarg)
from pandas.compat import zip, u

import pandas.core.indexes.base as ibase
_index_doc_kwargs = dict(ibase._index_doc_kwargs)
_index_doc_kwargs.update(
    dict(target_klass='PeriodIndex or list of Periods'))


def _field_accessor(name, alias, docstring=None):
    def f(self):
        base, mult = _gfc(self.freq)
        result = get_period_field_arr(alias, self._values, base)
        return Index(result, name=self.name)
    f.__name__ = name
    f.__doc__ = docstring
    return property(f)


def dt64arr_to_periodarr(data, freq, tz):
    if data.dtype != np.dtype('M8[ns]'):
        raise ValueError('Wrong dtype: %s' % data.dtype)

    freq = Period._maybe_convert_freq(freq)
    base, mult = _gfc(freq)
    return period.dt64arr_to_periodarr(data.view('i8'), base, tz)

# --- Period index sketch


_DIFFERENT_FREQ_INDEX = period._DIFFERENT_FREQ_INDEX


def _period_index_cmp(opname, nat_result=False):
    """
    Wrap comparison operations to convert datetime-like to datetime64
    """

    def wrapper(self, other):
        if isinstance(other, Period):
            func = getattr(self._values, opname)
            other_base, _ = _gfc(other.freq)
            if other.freq != self.freq:
                msg = _DIFFERENT_FREQ_INDEX.format(self.freqstr, other.freqstr)
                raise IncompatibleFrequency(msg)

            result = func(other.ordinal)
        elif isinstance(other, PeriodIndex):
            if other.freq != self.freq:
                msg = _DIFFERENT_FREQ_INDEX.format(self.freqstr, other.freqstr)
                raise IncompatibleFrequency(msg)

            result = getattr(self._values, opname)(other._values)

            mask = self._isnan | other._isnan
            if mask.any():
                result[mask] = nat_result

            return result
        elif other is tslib.NaT:
            result = np.empty(len(self._values), dtype=bool)
            result.fill(nat_result)
        else:
            other = Period(other, freq=self.freq)
            func = getattr(self._values, opname)
            result = func(other.ordinal)

        if self.hasnans:
            result[self._isnan] = nat_result

        return result
    return wrapper


def _new_PeriodIndex(cls, **d):
    # GH13277 for unpickling
    if d['data'].dtype == 'int64':
        values = d.pop('data')
    return cls._from_ordinals(values=values, **d)


class PeriodIndex(DatelikeOps, DatetimeIndexOpsMixin, Int64Index):
    """
    Immutable ndarray holding ordinal values indicating regular periods in
    time such as particular years, quarters, months, etc. A value of 1 is the
    period containing the Gregorian proleptic datetime Jan 1, 0001 00:00:00.
    This ordinal representation is from the scikits.timeseries project.

    For instance,
        # construct period for day 1/1/1 and get the first second
        i = Period(year=1,month=1,day=1,freq='D').asfreq('S', 'S')
        i.ordinal
        ===> 1

    Index keys are boxed to Period objects which carries the metadata (eg,
    frequency information).

    Parameters
    ----------
    data : array-like (1-dimensional), optional
        Optional period-like data to construct index with
    copy : bool
        Make a copy of input ndarray
    freq : string or period object, optional
        One of pandas period strings or corresponding objects
    start : starting value, period-like, optional
        If data is None, used as the start point in generating regular
        period data.
    periods : int, optional, > 0
        Number of periods to generate, if generating index. Takes precedence
        over end argument
    end : end value, period-like, optional
        If periods is none, generated index will extend to first conforming
        period on or just past end argument
    year : int, array, or Series, default None
    month : int, array, or Series, default None
    quarter : int, array, or Series, default None
    day : int, array, or Series, default None
    hour : int, array, or Series, default None
    minute : int, array, or Series, default None
    second : int, array, or Series, default None
    tz : object, default None
        Timezone for converting datetime64 data to Periods
    dtype : str or PeriodDtype, default None

    Examples
    --------
    >>> idx = PeriodIndex(year=year_arr, quarter=q_arr)

    >>> idx2 = PeriodIndex(start='2000', end='2010', freq='A')
    """
    _box_scalars = True
    _typ = 'periodindex'
    _attributes = ['name', 'freq']

    # define my properties & methods for delegation
    _other_ops = []
    _bool_ops = ['is_leap_year']
    _object_ops = ['start_time', 'end_time', 'freq']
    _field_ops = ['year', 'month', 'day', 'hour', 'minute', 'second',
                  'weekofyear', 'weekday', 'week', 'dayofweek',
                  'dayofyear', 'quarter', 'qyear',
                  'days_in_month', 'daysinmonth']
    _datetimelike_ops = _field_ops + _object_ops + _bool_ops
    _datetimelike_methods = ['strftime', 'to_timestamp', 'asfreq']

    _is_numeric_dtype = False
    _infer_as_myclass = True

    freq = None

    __eq__ = _period_index_cmp('__eq__')
    __ne__ = _period_index_cmp('__ne__', nat_result=True)
    __lt__ = _period_index_cmp('__lt__')
    __gt__ = _period_index_cmp('__gt__')
    __le__ = _period_index_cmp('__le__')
    __ge__ = _period_index_cmp('__ge__')

    def __new__(cls, data=None, ordinal=None, freq=None, start=None, end=None,
                periods=None, copy=False, name=None, tz=None, dtype=None,
                **kwargs):

        if periods is not None:
            if is_float(periods):
                periods = int(periods)
            elif not is_integer(periods):
                raise ValueError('Periods must be a number, got %s' %
                                 str(periods))

        if name is None and hasattr(data, 'name'):
            name = data.name

        if dtype is not None:
            dtype = pandas_dtype(dtype)
            if not is_period_dtype(dtype):
                raise ValueError('dtype must be PeriodDtype')
            if freq is None:
                freq = dtype.freq
            elif freq != dtype.freq:
                msg = 'specified freq and dtype are different'
                raise IncompatibleFrequency(msg)

        # coerce freq to freq object, otherwise it can be coerced elementwise
        # which is slow
        if freq:
            freq = Period._maybe_convert_freq(freq)

        if data is None:
            if ordinal is not None:
                data = np.asarray(ordinal, dtype=np.int64)
            else:
                data, freq = cls._generate_range(start, end, periods,
                                                 freq, kwargs)
            return cls._from_ordinals(data, name=name, freq=freq)

        if isinstance(data, PeriodIndex):
            if freq is None or freq == data.freq:  # no freq change
                freq = data.freq
                data = data._values
            else:
                base1, _ = _gfc(data.freq)
                base2, _ = _gfc(freq)
                data = period.period_asfreq_arr(data._values,
                                                base1, base2, 1)
            return cls._simple_new(data, name=name, freq=freq)

        # not array / index
        if not isinstance(data, (np.ndarray, PeriodIndex,
                                 DatetimeIndex, Int64Index)):
            if is_scalar(data) or isinstance(data, Period):
                cls._scalar_data_error(data)

            # other iterable of some kind
            if not isinstance(data, (list, tuple)):
                data = list(data)

            data = np.asarray(data)

        # datetime other than period
        if is_datetime64_dtype(data.dtype):
            data = dt64arr_to_periodarr(data, freq, tz)
            return cls._from_ordinals(data, name=name, freq=freq)

        # check not floats
        if infer_dtype(data) == 'floating' and len(data) > 0:
            raise TypeError("PeriodIndex does not allow "
                            "floating point in construction")

        # anything else, likely an array of strings or periods
        data = _ensure_object(data)
        freq = freq or period.extract_freq(data)
        data = period.extract_ordinals(data, freq)
        return cls._from_ordinals(data, name=name, freq=freq)

    @classmethod
    def _generate_range(cls, start, end, periods, freq, fields):
        if freq is not None:
            freq = Period._maybe_convert_freq(freq)

        field_count = len(fields)
        if com._count_not_none(start, end) > 0:
            if field_count > 0:
                raise ValueError('Can either instantiate from fields '
                                 'or endpoints, but not both')
            subarr, freq = _get_ordinal_range(start, end, periods, freq)
        elif field_count > 0:
            subarr, freq = _range_from_fields(freq=freq, **fields)
        else:
            raise ValueError('Not enough parameters to construct '
                             'Period range')

        return subarr, freq

    @classmethod
    def _simple_new(cls, values, name=None, freq=None, **kwargs):
        """
        Values can be any type that can be coerced to Periods.
        Ordinals in an ndarray are fastpath-ed to `_from_ordinals`
        """
        if not is_integer_dtype(values):
            values = np.array(values, copy=False)
            if len(values) > 0 and is_float_dtype(values):
                raise TypeError("PeriodIndex can't take floats")
            return cls(values, name=name, freq=freq, **kwargs)

        return cls._from_ordinals(values, name, freq, **kwargs)

    @classmethod
    def _from_ordinals(cls, values, name=None, freq=None, **kwargs):
        """
        Values should be int ordinals
        `__new__` & `_simple_new` cooerce to ordinals and call this method
        """

        values = np.array(values, dtype='int64', copy=False)

        result = object.__new__(cls)
        result._data = values
        result.name = name
        if freq is None:
            raise ValueError('freq is not specified and cannot be inferred')
        result.freq = Period._maybe_convert_freq(freq)
        result._reset_identity()
        return result

    def _shallow_copy_with_infer(self, values=None, **kwargs):
        """ we always want to return a PeriodIndex """
        return self._shallow_copy(values=values, **kwargs)

    def _shallow_copy(self, values=None, freq=None, **kwargs):
        if freq is None:
            freq = self.freq
        if values is None:
            values = self._values
        return super(PeriodIndex, self)._shallow_copy(values=values,
                                                      freq=freq, **kwargs)

    def _coerce_scalar_to_index(self, item):
        """
        we need to coerce a scalar to a compat for our index type

        Parameters
        ----------
        item : scalar item to coerce
        """
        return PeriodIndex([item], **self._get_attributes_dict())

    @Appender(_index_shared_docs['__contains__'])
    def __contains__(self, key):
        if isinstance(key, Period):
            if key.freq != self.freq:
                return False
            else:
                return key.ordinal in self._engine
        else:
            try:
                self.get_loc(key)
                return True
            except Exception:
                return False
            return False

    contains = __contains__

    @property
    def asi8(self):
        return self._values.view('i8')

    @cache_readonly
    def _int64index(self):
        return Int64Index(self.asi8, name=self.name, fastpath=True)

    @property
    def values(self):
        return self.asobject.values

    @property
    def _values(self):
        return self._data

    def __array__(self, dtype=None):
        if is_integer_dtype(dtype):
            return self.asi8
        else:
            return self.asobject.values

    def __array_wrap__(self, result, context=None):
        """
        Gets called after a ufunc. Needs additional handling as
        PeriodIndex stores internal data as int dtype

        Replace this to __numpy_ufunc__ in future version
        """
        if isinstance(context, tuple) and len(context) > 0:
            func = context[0]
            if (func is np.add):
                pass
            elif (func is np.subtract):
                name = self.name
                left = context[1][0]
                right = context[1][1]
                if (isinstance(left, PeriodIndex) and
                        isinstance(right, PeriodIndex)):
                    name = left.name if left.name == right.name else None
                    return Index(result, name=name)
                elif isinstance(left, Period) or isinstance(right, Period):
                    return Index(result, name=name)
            elif isinstance(func, np.ufunc):
                if 'M->M' not in func.types:
                    msg = "ufunc '{0}' not supported for the PeriodIndex"
                    # This should be TypeError, but TypeError cannot be raised
                    # from here because numpy catches.
                    raise ValueError(msg.format(func.__name__))

        if is_bool_dtype(result):
            return result
        # the result is object dtype array of Period
        # cannot pass _simple_new as it is
        return self._shallow_copy(result, freq=self.freq, name=self.name)

    @property
    def _box_func(self):
        return lambda x: Period._from_ordinal(ordinal=x, freq=self.freq)

    def _to_embed(self, keep_tz=False):
        """
        return an array repr of this object, potentially casting to object
        """
        return self.asobject.values

    @property
    def _formatter_func(self):
        return lambda x: "'%s'" % x

    def asof_locs(self, where, mask):
        """
        where : array of timestamps
        mask : array of booleans where data is not NA

        """
        where_idx = where
        if isinstance(where_idx, DatetimeIndex):
            where_idx = PeriodIndex(where_idx.values, freq=self.freq)

        locs = self._values[mask].searchsorted(where_idx._values, side='right')

        locs = np.where(locs > 0, locs - 1, 0)
        result = np.arange(len(self))[mask].take(locs)

        first = mask.argmax()
        result[(locs == 0) & (where_idx._values < self._values[first])] = -1

        return result

    @Appender(_index_shared_docs['astype'])
    def astype(self, dtype, copy=True, how='start'):
        dtype = pandas_dtype(dtype)
        if is_object_dtype(dtype):
            return self.asobject
        elif is_integer_dtype(dtype):
            if copy:
                return self._int64index.copy()
            else:
                return self._int64index
        elif is_datetime64_dtype(dtype):
            return self.to_timestamp(how=how)
        elif is_datetime64tz_dtype(dtype):
            return self.to_timestamp(how=how).tz_localize(dtype.tz)
        elif is_period_dtype(dtype):
            return self.asfreq(freq=dtype.freq)
        raise ValueError('Cannot cast PeriodIndex to dtype %s' % dtype)

    @Substitution(klass='PeriodIndex')
    @Appender(_shared_docs['searchsorted'])
    @deprecate_kwarg(old_arg_name='key', new_arg_name='value')
    def searchsorted(self, value, side='left', sorter=None):
        if isinstance(value, Period):
            if value.freq != self.freq:
                msg = _DIFFERENT_FREQ_INDEX.format(self.freqstr, value.freqstr)
                raise IncompatibleFrequency(msg)
            value = value.ordinal
        elif isinstance(value, compat.string_types):
            value = Period(value, freq=self.freq).ordinal

        return self._values.searchsorted(value, side=side, sorter=sorter)

    @property
    def is_all_dates(self):
        return True

    @property
    def is_full(self):
        """
        Returns True if there are any missing periods from start to end
        """
        if len(self) == 0:
            return True
        if not self.is_monotonic:
            raise ValueError('Index is not monotonic')
        values = self.values
        return ((values[1:] - values[:-1]) < 2).all()

    def asfreq(self, freq=None, how='E'):
        """
        Convert the PeriodIndex to the specified frequency `freq`.

        Parameters
        ----------

        freq : str
            a frequency
        how : str {'E', 'S'}
            'E', 'END', or 'FINISH' for end,
            'S', 'START', or 'BEGIN' for start.
            Whether the elements should be aligned to the end
            or start within pa period. January 31st ('END') vs.
            Janury 1st ('START') for example.

        Returns
        -------

        new : PeriodIndex with the new frequency

        Examples
        --------
        >>> pidx = pd.period_range('2010-01-01', '2015-01-01', freq='A')
        >>> pidx
        <class 'pandas.core.indexes.period.PeriodIndex'>
        [2010, ..., 2015]
        Length: 6, Freq: A-DEC

        >>> pidx.asfreq('M')
        <class 'pandas.core.indexes.period.PeriodIndex'>
        [2010-12, ..., 2015-12]
        Length: 6, Freq: M

        >>> pidx.asfreq('M', how='S')
        <class 'pandas.core.indexes.period.PeriodIndex'>
        [2010-01, ..., 2015-01]
        Length: 6, Freq: M
        """
        how = _validate_end_alias(how)

        freq = Period._maybe_convert_freq(freq)

        base1, mult1 = _gfc(self.freq)
        base2, mult2 = _gfc(freq)

        asi8 = self.asi8
        # mult1 can't be negative or 0
        end = how == 'E'
        if end:
            ordinal = asi8 + mult1 - 1
        else:
            ordinal = asi8

        new_data = period.period_asfreq_arr(ordinal, base1, base2, end)

        if self.hasnans:
            new_data[self._isnan] = tslib.iNaT

        return self._simple_new(new_data, self.name, freq=freq)

    def to_datetime(self, dayfirst=False):
        """
        DEPRECATED: use :meth:`to_timestamp` instead.

        Cast to DatetimeIndex.
        """
        warnings.warn("to_datetime is deprecated. Use self.to_timestamp(...)",
                      FutureWarning, stacklevel=2)
        return self.to_timestamp()

    year = _field_accessor('year', 0, "The year of the period")
    month = _field_accessor('month', 3, "The month as January=1, December=12")
    day = _field_accessor('day', 4, "The days of the period")
    hour = _field_accessor('hour', 5, "The hour of the period")
    minute = _field_accessor('minute', 6, "The minute of the period")
    second = _field_accessor('second', 7, "The second of the period")
    weekofyear = _field_accessor('week', 8, "The week ordinal of the year")
    week = weekofyear
    dayofweek = _field_accessor('dayofweek', 10,
                                "The day of the week with Monday=0, Sunday=6")
    weekday = dayofweek
    dayofyear = day_of_year = _field_accessor('dayofyear', 9,
                                              "The ordinal day of the year")
    quarter = _field_accessor('quarter', 2, "The quarter of the date")
    qyear = _field_accessor('qyear', 1)
    days_in_month = _field_accessor('days_in_month', 11,
                                    "The number of days in the month")
    daysinmonth = days_in_month

    @property
    def is_leap_year(self):
        """ Logical indicating if the date belongs to a leap year """
        return tslib._isleapyear_arr(np.asarray(self.year))

    @property
    def start_time(self):
        return self.to_timestamp(how='start')

    @property
    def end_time(self):
        return self.to_timestamp(how='end')

    def _mpl_repr(self):
        # how to represent ourselves to matplotlib
        return self.asobject.values

    def to_timestamp(self, freq=None, how='start'):
        """
        Cast to DatetimeIndex

        Parameters
        ----------
        freq : string or DateOffset, default 'D' for week or longer, 'S'
               otherwise
            Target frequency
        how : {'s', 'e', 'start', 'end'}

        Returns
        -------
        DatetimeIndex
        """
        how = _validate_end_alias(how)

        if freq is None:
            base, mult = _gfc(self.freq)
            freq = frequencies.get_to_timestamp_base(base)
        else:
            freq = Period._maybe_convert_freq(freq)

        base, mult = _gfc(freq)
        new_data = self.asfreq(freq, how)

        new_data = period.periodarr_to_dt64arr(new_data._values, base)
        return DatetimeIndex(new_data, freq='infer', name=self.name)

    def _maybe_convert_timedelta(self, other):
        if isinstance(other, (timedelta, np.timedelta64, offsets.Tick)):
            offset = frequencies.to_offset(self.freq.rule_code)
            if isinstance(offset, offsets.Tick):
                nanos = tslib._delta_to_nanoseconds(other)
                offset_nanos = tslib._delta_to_nanoseconds(offset)
                if nanos % offset_nanos == 0:
                    return nanos // offset_nanos
        elif isinstance(other, offsets.DateOffset):
            freqstr = other.rule_code
            base = frequencies.get_base_alias(freqstr)
            if base == self.freq.rule_code:
                return other.n
            msg = _DIFFERENT_FREQ_INDEX.format(self.freqstr, other.freqstr)
            raise IncompatibleFrequency(msg)
        elif isinstance(other, np.ndarray):
            if is_integer_dtype(other):
                return other
            elif is_timedelta64_dtype(other):
                offset = frequencies.to_offset(self.freq)
                if isinstance(offset, offsets.Tick):
                    nanos = tslib._delta_to_nanoseconds(other)
                    offset_nanos = tslib._delta_to_nanoseconds(offset)
                    if (nanos % offset_nanos).all() == 0:
                        return nanos // offset_nanos
        elif is_integer(other):
            # integer is passed to .shift via
            # _add_datetimelike_methods basically
            # but ufunc may pass integer to _add_delta
            return other
        # raise when input doesn't have freq
        msg = "Input has different freq from PeriodIndex(freq={0})"
        raise IncompatibleFrequency(msg.format(self.freqstr))

    def _add_delta(self, other):
        ordinal_delta = self._maybe_convert_timedelta(other)
        return self.shift(ordinal_delta)

    def _sub_datelike(self, other):
        if other is tslib.NaT:
            new_data = np.empty(len(self), dtype=np.int64)
            new_data.fill(tslib.iNaT)
            return TimedeltaIndex(new_data, name=self.name)
        return NotImplemented

    def _sub_period(self, other):
        if self.freq != other.freq:
            msg = _DIFFERENT_FREQ_INDEX.format(self.freqstr, other.freqstr)
            raise IncompatibleFrequency(msg)

        asi8 = self.asi8
        new_data = asi8 - other.ordinal

        if self.hasnans:
            new_data = new_data.astype(np.float64)
            new_data[self._isnan] = np.nan
        # result must be Int64Index or Float64Index
        return Index(new_data, name=self.name)

    def shift(self, n):
        """
        Specialized shift which produces an PeriodIndex

        Parameters
        ----------
        n : int
            Periods to shift by

        Returns
        -------
        shifted : PeriodIndex
        """
        values = self._values + n * self.freq.n
        if self.hasnans:
            values[self._isnan] = tslib.iNaT
        return self._shallow_copy(values=values)

    @cache_readonly
    def dtype(self):
        return PeriodDtype.construct_from_string(self.freq)

    @property
    def inferred_type(self):
        # b/c data is represented as ints make sure we can't have ambiguous
        # indexing
        return 'period'

    def get_value(self, series, key):
        """
        Fast lookup of value from 1-dimensional ndarray. Only use this if you
        know what you're doing
        """
        s = com._values_from_object(series)
        try:
            return com._maybe_box(self,
                                  super(PeriodIndex, self).get_value(s, key),
                                  series, key)
        except (KeyError, IndexError):
            try:
                asdt, parsed, reso = parse_time_string(key, self.freq)
                grp = frequencies.Resolution.get_freq_group(reso)
                freqn = frequencies.get_freq_group(self.freq)

                vals = self._values

                # if our data is higher resolution than requested key, slice
                if grp < freqn:
                    iv = Period(asdt, freq=(grp, 1))
                    ord1 = iv.asfreq(self.freq, how='S').ordinal
                    ord2 = iv.asfreq(self.freq, how='E').ordinal

                    if ord2 < vals[0] or ord1 > vals[-1]:
                        raise KeyError(key)

                    pos = np.searchsorted(self._values, [ord1, ord2])
                    key = slice(pos[0], pos[1] + 1)
                    return series[key]
                elif grp == freqn:
                    key = Period(asdt, freq=self.freq).ordinal
                    return com._maybe_box(self, self._engine.get_value(s, key),
                                          series, key)
                else:
                    raise KeyError(key)
            except TypeError:
                pass

            key = Period(key, self.freq).ordinal
            return com._maybe_box(self, self._engine.get_value(s, key),
                                  series, key)

    @Appender(_index_shared_docs['get_indexer'] % _index_doc_kwargs)
    def get_indexer(self, target, method=None, limit=None, tolerance=None):
        target = _ensure_index(target)

        if hasattr(target, 'freq') and target.freq != self.freq:
            msg = _DIFFERENT_FREQ_INDEX.format(self.freqstr, target.freqstr)
            raise IncompatibleFrequency(msg)

        if isinstance(target, PeriodIndex):
            target = target.asi8

        if tolerance is not None:
            tolerance = self._convert_tolerance(tolerance)
        return Index.get_indexer(self._int64index, target, method,
                                 limit, tolerance)

    def _get_unique_index(self, dropna=False):
        """
        wrap Index._get_unique_index to handle NaT
        """
        res = super(PeriodIndex, self)._get_unique_index(dropna=dropna)
        if dropna:
            res = res.dropna()
        return res

    def get_loc(self, key, method=None, tolerance=None):
        """
        Get integer location for requested label

        Returns
        -------
        loc : int
        """
        try:
            return self._engine.get_loc(key)
        except KeyError:
            if is_integer(key):
                raise

            try:
                asdt, parsed, reso = parse_time_string(key, self.freq)
                key = asdt
            except TypeError:
                pass

            try:
                key = Period(key, freq=self.freq)
            except ValueError:
                # we cannot construct the Period
                # as we have an invalid type
                raise KeyError(key)

            try:
                ordinal = tslib.iNaT if key is tslib.NaT else key.ordinal
                if tolerance is not None:
                    tolerance = self._convert_tolerance(tolerance)
                return self._int64index.get_loc(ordinal, method, tolerance)

            except KeyError:
                raise KeyError(key)

    def _maybe_cast_slice_bound(self, label, side, kind):
        """
        If label is a string or a datetime, cast it to Period.ordinal according
        to resolution.

        Parameters
        ----------
        label : object
        side : {'left', 'right'}
        kind : {'ix', 'loc', 'getitem'}

        Returns
        -------
        bound : Period or object

        Notes
        -----
        Value of `side` parameter should be validated in caller.

        """
        assert kind in ['ix', 'loc', 'getitem']

        if isinstance(label, datetime):
            return Period(label, freq=self.freq)
        elif isinstance(label, compat.string_types):
            try:
                _, parsed, reso = parse_time_string(label, self.freq)
                bounds = self._parsed_string_to_bounds(reso, parsed)
                return bounds[0 if side == 'left' else 1]
            except Exception:
                raise KeyError(label)
        elif is_integer(label) or is_float(label):
            self._invalid_indexer('slice', label)

        return label

    def _parsed_string_to_bounds(self, reso, parsed):
        if reso == 'year':
            t1 = Period(year=parsed.year, freq='A')
        elif reso == 'month':
            t1 = Period(year=parsed.year, month=parsed.month, freq='M')
        elif reso == 'quarter':
            q = (parsed.month - 1) // 3 + 1
            t1 = Period(year=parsed.year, quarter=q, freq='Q-DEC')
        elif reso == 'day':
            t1 = Period(year=parsed.year, month=parsed.month, day=parsed.day,
                        freq='D')
        elif reso == 'hour':
            t1 = Period(year=parsed.year, month=parsed.month, day=parsed.day,
                        hour=parsed.hour, freq='H')
        elif reso == 'minute':
            t1 = Period(year=parsed.year, month=parsed.month, day=parsed.day,
                        hour=parsed.hour, minute=parsed.minute, freq='T')
        elif reso == 'second':
            t1 = Period(year=parsed.year, month=parsed.month, day=parsed.day,
                        hour=parsed.hour, minute=parsed.minute,
                        second=parsed.second, freq='S')
        else:
            raise KeyError(reso)
        return (t1.asfreq(self.freq, how='start'),
                t1.asfreq(self.freq, how='end'))

    def _get_string_slice(self, key):
        if not self.is_monotonic:
            raise ValueError('Partial indexing only valid for '
                             'ordered time series')

        key, parsed, reso = parse_time_string(key, self.freq)
        grp = frequencies.Resolution.get_freq_group(reso)
        freqn = frequencies.get_freq_group(self.freq)
        if reso in ['day', 'hour', 'minute', 'second'] and not grp < freqn:
            raise KeyError(key)

        t1, t2 = self._parsed_string_to_bounds(reso, parsed)
        return slice(self.searchsorted(t1.ordinal, side='left'),
                     self.searchsorted(t2.ordinal, side='right'))

    def _convert_tolerance(self, tolerance):
        tolerance = DatetimeIndexOpsMixin._convert_tolerance(self, tolerance)
        return self._maybe_convert_timedelta(tolerance)

    def insert(self, loc, item):
        if not isinstance(item, Period) or self.freq != item.freq:
            return self.asobject.insert(loc, item)

        idx = np.concatenate((self[:loc].asi8, np.array([item.ordinal]),
                              self[loc:].asi8))
        return self._shallow_copy(idx)

    def join(self, other, how='left', level=None, return_indexers=False):
        """
        See Index.join
        """
        self._assert_can_do_setop(other)

        result = Int64Index.join(self, other, how=how, level=level,
                                 return_indexers=return_indexers)

        if return_indexers:
            result, lidx, ridx = result
            return self._apply_meta(result), lidx, ridx
        return self._apply_meta(result)

    def _assert_can_do_setop(self, other):
        super(PeriodIndex, self)._assert_can_do_setop(other)

        if not isinstance(other, PeriodIndex):
            raise ValueError('can only call with other PeriodIndex-ed objects')

        if self.freq != other.freq:
            msg = _DIFFERENT_FREQ_INDEX.format(self.freqstr, other.freqstr)
            raise IncompatibleFrequency(msg)

    def _wrap_union_result(self, other, result):
        name = self.name if self.name == other.name else None
        result = self._apply_meta(result)
        result.name = name
        return result

    def _apply_meta(self, rawarr):
        if not isinstance(rawarr, PeriodIndex):
            rawarr = PeriodIndex._from_ordinals(rawarr, freq=self.freq,
                                                name=self.name)
        return rawarr

    def _format_native_types(self, na_rep=u('NaT'), date_format=None,
                             **kwargs):

        values = self.asobject.values

        if date_format:
            formatter = lambda dt: dt.strftime(date_format)
        else:
            formatter = lambda dt: u('%s') % dt

        if self.hasnans:
            mask = self._isnan
            values[mask] = na_rep
            imask = ~mask
            values[imask] = np.array([formatter(dt) for dt
                                      in values[imask]])
        else:
            values = np.array([formatter(dt) for dt in values])
        return values

    def __setstate__(self, state):
        """Necessary for making this object picklable"""

        if isinstance(state, dict):
            super(PeriodIndex, self).__setstate__(state)

        elif isinstance(state, tuple):

            # < 0.15 compat
            if len(state) == 2:
                nd_state, own_state = state
                data = np.empty(nd_state[1], dtype=nd_state[2])
                np.ndarray.__setstate__(data, nd_state)

                # backcompat
                self.freq = Period._maybe_convert_freq(own_state[1])

            else:  # pragma: no cover
                data = np.empty(state)
                np.ndarray.__setstate__(self, state)

            self._data = data

        else:
            raise Exception("invalid pickle state")

    _unpickle_compat = __setstate__

    def tz_convert(self, tz):
        """
        Convert tz-aware DatetimeIndex from one time zone to another (using
        pytz/dateutil)

        Parameters
        ----------
        tz : string, pytz.timezone, dateutil.tz.tzfile or None
            Time zone for time. Corresponding timestamps would be converted to
            time zone of the TimeSeries.
            None will remove timezone holding UTC time.

        Returns
        -------
        normalized : DatetimeIndex

        Note
        ----
        Not currently implemented for PeriodIndex
        """
        raise NotImplementedError("Not yet implemented for PeriodIndex")

    def tz_localize(self, tz, infer_dst=False):
        """
        Localize tz-naive DatetimeIndex to given time zone (using
        pytz/dateutil), or remove timezone from tz-aware DatetimeIndex

        Parameters
        ----------
        tz : string, pytz.timezone, dateutil.tz.tzfile or None
            Time zone for time. Corresponding timestamps would be converted to
            time zone of the TimeSeries.
            None will remove timezone holding local time.
        infer_dst : boolean, default False
            Attempt to infer fall dst-transition hours based on order

        Returns
        -------
        localized : DatetimeIndex

        Note
        ----
        Not currently implemented for PeriodIndex
        """
        raise NotImplementedError("Not yet implemented for PeriodIndex")


PeriodIndex._add_numeric_methods_disabled()
PeriodIndex._add_logical_methods_disabled()
PeriodIndex._add_datetimelike_methods()


def _get_ordinal_range(start, end, periods, freq, mult=1):
    if com._count_not_none(start, end, periods) < 2:
        raise ValueError('Must specify 2 of start, end, periods')

    if freq is not None:
        _, mult = _gfc(freq)

    if start is not None:
        start = Period(start, freq)
    if end is not None:
        end = Period(end, freq)

    is_start_per = isinstance(start, Period)
    is_end_per = isinstance(end, Period)

    if is_start_per and is_end_per and start.freq != end.freq:
        raise ValueError('Start and end must have same freq')
    if (start is tslib.NaT or end is tslib.NaT):
        raise ValueError('Start and end must not be NaT')

    if freq is None:
        if is_start_per:
            freq = start.freq
        elif is_end_per:
            freq = end.freq
        else:  # pragma: no cover
            raise ValueError('Could not infer freq from start/end')

    if periods is not None:
        periods = periods * mult
        if start is None:
            data = np.arange(end.ordinal - periods + mult,
                             end.ordinal + 1, mult,
                             dtype=np.int64)
        else:
            data = np.arange(start.ordinal, start.ordinal + periods, mult,
                             dtype=np.int64)
    else:
        data = np.arange(start.ordinal, end.ordinal + 1, mult, dtype=np.int64)

    return data, freq


def _range_from_fields(year=None, month=None, quarter=None, day=None,
                       hour=None, minute=None, second=None, freq=None):
    if hour is None:
        hour = 0
    if minute is None:
        minute = 0
    if second is None:
        second = 0
    if day is None:
        day = 1

    ordinals = []

    if quarter is not None:
        if freq is None:
            freq = 'Q'
            base = frequencies.FreqGroup.FR_QTR
        else:
            base, mult = _gfc(freq)
            if base != frequencies.FreqGroup.FR_QTR:
                raise AssertionError("base must equal FR_QTR")

        year, quarter = _make_field_arrays(year, quarter)
        for y, q in zip(year, quarter):
            y, m = _quarter_to_myear(y, q, freq)
            val = period.period_ordinal(y, m, 1, 1, 1, 1, 0, 0, base)
            ordinals.append(val)
    else:
        base, mult = _gfc(freq)
        arrays = _make_field_arrays(year, month, day, hour, minute, second)
        for y, mth, d, h, mn, s in zip(*arrays):
            ordinals.append(period.period_ordinal(
                y, mth, d, h, mn, s, 0, 0, base))

    return np.array(ordinals, dtype=np.int64), freq


def _make_field_arrays(*fields):
    length = None
    for x in fields:
        if isinstance(x, (list, np.ndarray, ABCSeries)):
            if length is not None and len(x) != length:
                raise ValueError('Mismatched Period array lengths')
            elif length is None:
                length = len(x)

    arrays = [np.asarray(x) if isinstance(x, (np.ndarray, list, ABCSeries))
              else np.repeat(x, length) for x in fields]

    return arrays


def pnow(freq=None):
    # deprecation, xref #13790
    import warnings

    warnings.warn("pd.pnow() and pandas.core.indexes.period.pnow() "
                  "are deprecated. Please use Period.now()",
                  FutureWarning, stacklevel=2)
    return Period.now(freq=freq)


def period_range(start=None, end=None, periods=None, freq='D', name=None):
    """
    Return a fixed frequency datetime index, with day (calendar) as the default
    frequency


    Parameters
    ----------
    start : starting value, period-like, optional
    end : ending value, period-like, optional
    periods : int, default None
        Number of periods in the index
    freq : str/DateOffset, default 'D'
        Frequency alias
    name : str, default None
        Name for the resulting PeriodIndex

    Returns
    -------
    prng : PeriodIndex
    """
    return PeriodIndex(start=start, end=end, periods=periods,
                       freq=freq, name=name)
