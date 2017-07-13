# pylint: disable=E1101
from __future__ import division
import operator
import warnings
from datetime import time, datetime
from datetime import timedelta
import numpy as np
from pandas.core.base import _shared_docs

from pandas.core.dtypes.common import (
    _NS_DTYPE, _INT64_DTYPE,
    is_object_dtype, is_datetime64_dtype,
    is_datetimetz, is_dtype_equal,
    is_integer, is_float,
    is_integer_dtype,
    is_datetime64_ns_dtype,
    is_period_dtype,
    is_bool_dtype,
    is_string_dtype,
    is_list_like,
    is_scalar,
    pandas_dtype,
    _ensure_int64)
from pandas.core.dtypes.generic import ABCSeries
from pandas.core.dtypes.dtypes import DatetimeTZDtype
from pandas.core.dtypes.missing import isnull

import pandas.core.dtypes.concat as _concat
from pandas.errors import PerformanceWarning
from pandas.core.common import _values_from_object, _maybe_box

from pandas.core.indexes.base import Index, _index_shared_docs
from pandas.core.indexes.numeric import Int64Index, Float64Index
import pandas.compat as compat
from pandas.tseries.frequencies import (
    to_offset, get_period_alias,
    Resolution)
from pandas.core.indexes.datetimelike import (
    DatelikeOps, TimelikeOps, DatetimeIndexOpsMixin)
from pandas.tseries.offsets import DateOffset, generate_range, Tick, CDay
from pandas.core.tools.datetimes import (
    parse_time_string, normalize_date, to_time)
from pandas.core.tools.timedeltas import to_timedelta
from pandas.util._decorators import (Appender, cache_readonly,
                                     deprecate_kwarg, Substitution)
import pandas.core.common as com
import pandas.tseries.offsets as offsets
import pandas.core.tools.datetimes as tools

from pandas._libs import (lib, index as libindex, tslib as libts,
                          algos as libalgos, join as libjoin,
                          Timestamp, period as libperiod)


def _utc():
    import pytz
    return pytz.utc

# -------- some conversion wrapper functions


def _field_accessor(name, field, docstring=None):
    def f(self):
        values = self.asi8
        if self.tz is not None:
            utc = _utc()
            if self.tz is not utc:
                values = self._local_timestamps()

        if field in self._bool_ops:
            if field in ['is_month_start', 'is_month_end',
                         'is_quarter_start', 'is_quarter_end',
                         'is_year_start', 'is_year_end']:
                month_kw = (self.freq.kwds.get('startingMonth',
                                               self.freq.kwds.get('month', 12))
                            if self.freq else 12)

                result = libts.get_start_end_field(values, field, self.freqstr,
                                                   month_kw)
            else:
                result = libts.get_date_field(values, field)

            # these return a boolean by-definition
            return result

        if field in self._object_ops:
            result = libts.get_date_name_field(values, field)
            result = self._maybe_mask_results(result)

        else:
            result = libts.get_date_field(values, field)
            result = self._maybe_mask_results(result, convert='float64')

        return Index(result, name=self.name)

    f.__name__ = name
    f.__doc__ = docstring
    return property(f)


def _dt_index_cmp(opname, nat_result=False):
    """
    Wrap comparison operations to convert datetime-like to datetime64
    """

    def wrapper(self, other):
        func = getattr(super(DatetimeIndex, self), opname)
        if (isinstance(other, datetime) or
                isinstance(other, compat.string_types)):
            other = _to_m8(other, tz=self.tz)
            result = func(other)
            if isnull(other):
                result.fill(nat_result)
        else:
            if isinstance(other, list):
                other = DatetimeIndex(other)
            elif not isinstance(other, (np.ndarray, Index, ABCSeries)):
                other = _ensure_datetime64(other)
            result = func(np.asarray(other))
            result = _values_from_object(result)

            if isinstance(other, Index):
                o_mask = other.values.view('i8') == libts.iNaT
            else:
                o_mask = other.view('i8') == libts.iNaT

            if o_mask.any():
                result[o_mask] = nat_result

        if self.hasnans:
            result[self._isnan] = nat_result

        # support of bool dtype indexers
        if is_bool_dtype(result):
            return result
        return Index(result)

    return wrapper


def _ensure_datetime64(other):
    if isinstance(other, np.datetime64):
        return other
    raise TypeError('%s type object %s' % (type(other), str(other)))


_midnight = time(0, 0)


def _new_DatetimeIndex(cls, d):
    """ This is called upon unpickling, rather than the default which doesn't
    have arguments and breaks __new__ """

    # data are already in UTC
    # so need to localize
    tz = d.pop('tz', None)

    result = cls.__new__(cls, verify_integrity=False, **d)
    if tz is not None:
        result = result.tz_localize('UTC').tz_convert(tz)
    return result


class DatetimeIndex(DatelikeOps, TimelikeOps, DatetimeIndexOpsMixin,
                    Int64Index):
    """
    Immutable ndarray of datetime64 data, represented internally as int64, and
    which can be boxed to Timestamp objects that are subclasses of datetime and
    carry metadata such as frequency information.

    Parameters
    ----------
    data  : array-like (1-dimensional), optional
        Optional datetime-like data to construct index with
    copy  : bool
        Make a copy of input ndarray
    freq : string or pandas offset object, optional
        One of pandas date offset strings or corresponding objects
    start : starting value, datetime-like, optional
        If data is None, start is used as the start point in generating regular
        timestamp data.
    periods  : int, optional, > 0
        Number of periods to generate, if generating index. Takes precedence
        over end argument
    end   : end time, datetime-like, optional
        If periods is none, generated index will extend to first conforming
        time on or just past end argument
    closed : string or None, default None
        Make the interval closed with respect to the given frequency to
        the 'left', 'right', or both sides (None)
    tz : pytz.timezone or dateutil.tz.tzfile
    ambiguous : 'infer', bool-ndarray, 'NaT', default 'raise'
        - 'infer' will attempt to infer fall dst-transition hours based on
          order
        - bool-ndarray where True signifies a DST time, False signifies a
          non-DST time (note that this flag is only applicable for ambiguous
          times)
        - 'NaT' will return NaT where there are ambiguous times
        - 'raise' will raise an AmbiguousTimeError if there are ambiguous times
    infer_dst : boolean, default False (DEPRECATED)
        Attempt to infer fall dst-transition hours based on order
    name : object
        Name to be stored in the index

    Notes
    -----

    To learn more about the frequency strings, please see `this link
    <http://pandas.pydata.org/pandas-docs/stable/timeseries.html#offset-aliases>`__.
    """

    _typ = 'datetimeindex'
    _join_precedence = 10

    def _join_i8_wrapper(joinf, **kwargs):
        return DatetimeIndexOpsMixin._join_i8_wrapper(joinf, dtype='M8[ns]',
                                                      **kwargs)

    _inner_indexer = _join_i8_wrapper(libjoin.inner_join_indexer_int64)
    _outer_indexer = _join_i8_wrapper(libjoin.outer_join_indexer_int64)
    _left_indexer = _join_i8_wrapper(libjoin.left_join_indexer_int64)
    _left_indexer_unique = _join_i8_wrapper(
        libjoin.left_join_indexer_unique_int64, with_indexers=False)
    _arrmap = None

    __eq__ = _dt_index_cmp('__eq__')
    __ne__ = _dt_index_cmp('__ne__', nat_result=True)
    __lt__ = _dt_index_cmp('__lt__')
    __gt__ = _dt_index_cmp('__gt__')
    __le__ = _dt_index_cmp('__le__')
    __ge__ = _dt_index_cmp('__ge__')

    _engine_type = libindex.DatetimeEngine

    tz = None
    offset = None
    _comparables = ['name', 'freqstr', 'tz']
    _attributes = ['name', 'freq', 'tz']

    # define my properties & methods for delegation
    _bool_ops = ['is_month_start', 'is_month_end',
                 'is_quarter_start', 'is_quarter_end', 'is_year_start',
                 'is_year_end', 'is_leap_year']
    _object_ops = ['weekday_name', 'freq', 'tz']
    _field_ops = ['year', 'month', 'day', 'hour', 'minute', 'second',
                  'weekofyear', 'week', 'weekday', 'dayofweek',
                  'dayofyear', 'quarter', 'days_in_month',
                  'daysinmonth', 'microsecond',
                  'nanosecond']
    _other_ops = ['date', 'time']
    _datetimelike_ops = _field_ops + _object_ops + _bool_ops + _other_ops
    _datetimelike_methods = ['to_period', 'tz_localize',
                             'tz_convert',
                             'normalize', 'strftime', 'round', 'floor',
                             'ceil']

    _is_numeric_dtype = False
    _infer_as_myclass = True

    @deprecate_kwarg(old_arg_name='infer_dst', new_arg_name='ambiguous',
                     mapping={True: 'infer', False: 'raise'})
    def __new__(cls, data=None,
                freq=None, start=None, end=None, periods=None,
                copy=False, name=None, tz=None,
                verify_integrity=True, normalize=False,
                closed=None, ambiguous='raise', dtype=None, **kwargs):

        # This allows to later ensure that the 'copy' parameter is honored:
        if isinstance(data, Index):
            ref_to_data = data._data
        else:
            ref_to_data = data

        if name is None and hasattr(data, 'name'):
            name = data.name

        dayfirst = kwargs.pop('dayfirst', None)
        yearfirst = kwargs.pop('yearfirst', None)

        freq_infer = False
        if not isinstance(freq, DateOffset):

            # if a passed freq is None, don't infer automatically
            if freq != 'infer':
                freq = to_offset(freq)
            else:
                freq_infer = True
                freq = None

        if periods is not None:
            if is_float(periods):
                periods = int(periods)
            elif not is_integer(periods):
                raise ValueError('Periods must be a number, got %s' %
                                 str(periods))

        if data is None and freq is None:
            raise ValueError("Must provide freq argument if no data is "
                             "supplied")

        # if dtype has an embeded tz, capture it
        if dtype is not None:
            try:
                dtype = DatetimeTZDtype.construct_from_string(dtype)
                dtz = getattr(dtype, 'tz', None)
                if dtz is not None:
                    if tz is not None and str(tz) != str(dtz):
                        raise ValueError("cannot supply both a tz and a dtype"
                                         " with a tz")
                    tz = dtz
            except TypeError:
                pass

        if data is None:
            return cls._generate(start, end, periods, name, freq,
                                 tz=tz, normalize=normalize, closed=closed,
                                 ambiguous=ambiguous)

        if not isinstance(data, (np.ndarray, Index, ABCSeries)):
            if is_scalar(data):
                raise ValueError('DatetimeIndex() must be called with a '
                                 'collection of some kind, %s was passed'
                                 % repr(data))
            # other iterable of some kind
            if not isinstance(data, (list, tuple)):
                data = list(data)
            data = np.asarray(data, dtype='O')
        elif isinstance(data, ABCSeries):
            data = data._values

        # data must be Index or np.ndarray here
        if not (is_datetime64_dtype(data) or is_datetimetz(data) or
                is_integer_dtype(data)):
            data = tools.to_datetime(data, dayfirst=dayfirst,
                                     yearfirst=yearfirst)

        if issubclass(data.dtype.type, np.datetime64) or is_datetimetz(data):

            if isinstance(data, DatetimeIndex):
                if tz is None:
                    tz = data.tz
                elif data.tz is None:
                    data = data.tz_localize(tz, ambiguous=ambiguous)
                else:
                    # the tz's must match
                    if str(tz) != str(data.tz):
                        msg = ('data is already tz-aware {0}, unable to '
                               'set specified tz: {1}')
                        raise TypeError(msg.format(data.tz, tz))

                subarr = data.values

                if freq is None:
                    freq = data.offset
                    verify_integrity = False
            else:
                if data.dtype != _NS_DTYPE:
                    subarr = libts.cast_to_nanoseconds(data)
                else:
                    subarr = data
        else:
            # must be integer dtype otherwise
            if isinstance(data, Int64Index):
                raise TypeError('cannot convert Int64Index->DatetimeIndex')
            if data.dtype != _INT64_DTYPE:
                data = data.astype(np.int64)
            subarr = data.view(_NS_DTYPE)

        if isinstance(subarr, DatetimeIndex):
            if tz is None:
                tz = subarr.tz
        else:
            if tz is not None:
                tz = libts.maybe_get_tz(tz)

                if (not isinstance(data, DatetimeIndex) or
                        getattr(data, 'tz', None) is None):
                    # Convert tz-naive to UTC
                    ints = subarr.view('i8')
                    subarr = libts.tz_localize_to_utc(ints, tz,
                                                      ambiguous=ambiguous)
                subarr = subarr.view(_NS_DTYPE)

        subarr = cls._simple_new(subarr, name=name, freq=freq, tz=tz)
        if dtype is not None:
            if not is_dtype_equal(subarr.dtype, dtype):
                # dtype must be coerced to DatetimeTZDtype above
                if subarr.tz is not None:
                    raise ValueError("cannot localize from non-UTC data")

        if verify_integrity and len(subarr) > 0:
            if freq is not None and not freq_infer:
                inferred = subarr.inferred_freq
                if inferred != freq.freqstr:
                    on_freq = cls._generate(subarr[0], None, len(subarr), None,
                                            freq, tz=tz, ambiguous=ambiguous)
                    if not np.array_equal(subarr.asi8, on_freq.asi8):
                        raise ValueError('Inferred frequency {0} from passed '
                                         'dates does not conform to passed '
                                         'frequency {1}'
                                         .format(inferred, freq.freqstr))

        if freq_infer:
            inferred = subarr.inferred_freq
            if inferred:
                subarr.offset = to_offset(inferred)

        return subarr._deepcopy_if_needed(ref_to_data, copy)

    @classmethod
    def _generate(cls, start, end, periods, name, offset,
                  tz=None, normalize=False, ambiguous='raise', closed=None):
        if com._count_not_none(start, end, periods) != 2:
            raise ValueError('Must specify two of start, end, or periods')

        _normalized = True

        if start is not None:
            start = Timestamp(start)

        if end is not None:
            end = Timestamp(end)

        left_closed = False
        right_closed = False

        if start is None and end is None:
            if closed is not None:
                raise ValueError("Closed has to be None if not both of start"
                                 "and end are defined")

        if closed is None:
            left_closed = True
            right_closed = True
        elif closed == "left":
            left_closed = True
        elif closed == "right":
            right_closed = True
        else:
            raise ValueError("Closed has to be either 'left', 'right' or None")

        try:
            inferred_tz = tools._infer_tzinfo(start, end)
        except:
            raise TypeError('Start and end cannot both be tz-aware with '
                            'different timezones')

        inferred_tz = libts.maybe_get_tz(inferred_tz)

        # these may need to be localized
        tz = libts.maybe_get_tz(tz)
        if tz is not None:
            date = start or end
            if date.tzinfo is not None and hasattr(tz, 'localize'):
                tz = tz.localize(date.replace(tzinfo=None)).tzinfo

        if tz is not None and inferred_tz is not None:
            if not libts.get_timezone(inferred_tz) == libts.get_timezone(tz):
                raise AssertionError("Inferred time zone not equal to passed "
                                     "time zone")

        elif inferred_tz is not None:
            tz = inferred_tz

        if start is not None:
            if normalize:
                start = normalize_date(start)
                _normalized = True
            else:
                _normalized = _normalized and start.time() == _midnight

        if end is not None:
            if normalize:
                end = normalize_date(end)
                _normalized = True
            else:
                _normalized = _normalized and end.time() == _midnight

        if hasattr(offset, 'delta') and offset != offsets.Day():
            if inferred_tz is None and tz is not None:
                # naive dates
                if start is not None and start.tz is None:
                    start = start.tz_localize(tz, ambiguous=False)

                if end is not None and end.tz is None:
                    end = end.tz_localize(tz, ambiguous=False)

            if start and end:
                if start.tz is None and end.tz is not None:
                    start = start.tz_localize(end.tz, ambiguous=False)

                if end.tz is None and start.tz is not None:
                    end = end.tz_localize(start.tz, ambiguous=False)

            if _use_cached_range(offset, _normalized, start, end):
                index = cls._cached_range(start, end, periods=periods,
                                          offset=offset, name=name)
            else:
                index = _generate_regular_range(start, end, periods, offset)

        else:

            if tz is not None:
                # naive dates
                if start is not None and start.tz is not None:
                    start = start.replace(tzinfo=None)

                if end is not None and end.tz is not None:
                    end = end.replace(tzinfo=None)

            if start and end:
                if start.tz is None and end.tz is not None:
                    end = end.replace(tzinfo=None)

                if end.tz is None and start.tz is not None:
                    start = start.replace(tzinfo=None)

            if _use_cached_range(offset, _normalized, start, end):
                index = cls._cached_range(start, end, periods=periods,
                                          offset=offset, name=name)
            else:
                index = _generate_regular_range(start, end, periods, offset)

            if tz is not None and getattr(index, 'tz', None) is None:
                index = libts.tz_localize_to_utc(_ensure_int64(index), tz,
                                                 ambiguous=ambiguous)
                index = index.view(_NS_DTYPE)

                # index is localized datetime64 array -> have to convert
                # start/end as well to compare
                if start is not None:
                    start = start.tz_localize(tz).asm8
                if end is not None:
                    end = end.tz_localize(tz).asm8

        if not left_closed and len(index) and index[0] == start:
            index = index[1:]
        if not right_closed and len(index) and index[-1] == end:
            index = index[:-1]
        index = cls._simple_new(index, name=name, freq=offset, tz=tz)
        return index

    @property
    def _box_func(self):
        return lambda x: Timestamp(x, freq=self.offset, tz=self.tz)

    def _convert_for_op(self, value):
        """ Convert value to be insertable to ndarray """
        if self._has_same_tz(value):
            return _to_m8(value)
        raise ValueError('Passed item and index have different timezone')

    def _local_timestamps(self):
        utc = _utc()

        if self.is_monotonic:
            return libts.tz_convert(self.asi8, utc, self.tz)
        else:
            values = self.asi8
            indexer = values.argsort()
            result = libts.tz_convert(values.take(indexer), utc, self.tz)

            n = len(indexer)
            reverse = np.empty(n, dtype=np.int_)
            reverse.put(indexer, np.arange(n))
            return result.take(reverse)

    @classmethod
    def _simple_new(cls, values, name=None, freq=None, tz=None,
                    dtype=None, **kwargs):
        """
        we require the we have a dtype compat for the values
        if we are passed a non-dtype compat, then coerce using the constructor
        """

        if getattr(values, 'dtype', None) is None:
            # empty, but with dtype compat
            if values is None:
                values = np.empty(0, dtype=_NS_DTYPE)
                return cls(values, name=name, freq=freq, tz=tz,
                           dtype=dtype, **kwargs)
            values = np.array(values, copy=False)

        if is_object_dtype(values):
            return cls(values, name=name, freq=freq, tz=tz,
                       dtype=dtype, **kwargs).values
        elif not is_datetime64_dtype(values):
            values = _ensure_int64(values).view(_NS_DTYPE)

        result = object.__new__(cls)
        result._data = values
        result.name = name
        result.offset = freq
        result.tz = libts.maybe_get_tz(tz)
        result._reset_identity()
        return result

    @property
    def tzinfo(self):
        """
        Alias for tz attribute
        """
        return self.tz

    @cache_readonly
    def _timezone(self):
        """ Comparable timezone both for pytz / dateutil"""
        return libts.get_timezone(self.tzinfo)

    def _has_same_tz(self, other):
        zzone = self._timezone

        # vzone sholdn't be None if value is non-datetime like
        if isinstance(other, np.datetime64):
            # convert to Timestamp as np.datetime64 doesn't have tz attr
            other = Timestamp(other)
        vzone = libts.get_timezone(getattr(other, 'tzinfo', '__no_tz__'))
        return zzone == vzone

    @classmethod
    def _cached_range(cls, start=None, end=None, periods=None, offset=None,
                      name=None):
        if start is None and end is None:
            # I somewhat believe this should never be raised externally
            raise TypeError('Must specify either start or end.')
        if start is not None:
            start = Timestamp(start)
        if end is not None:
            end = Timestamp(end)
        if (start is None or end is None) and periods is None:
            raise TypeError(
                'Must either specify period or provide both start and end.')

        if offset is None:
            # This can't happen with external-facing code
            raise TypeError('Must provide offset.')

        drc = _daterange_cache
        if offset not in _daterange_cache:
            xdr = generate_range(offset=offset, start=_CACHE_START,
                                 end=_CACHE_END)

            arr = tools.to_datetime(list(xdr), box=False)

            cachedRange = DatetimeIndex._simple_new(arr)
            cachedRange.offset = offset
            cachedRange.tz = None
            cachedRange.name = None
            drc[offset] = cachedRange
        else:
            cachedRange = drc[offset]

        if start is None:
            if not isinstance(end, Timestamp):
                raise AssertionError('end must be an instance of Timestamp')

            end = offset.rollback(end)

            endLoc = cachedRange.get_loc(end) + 1
            startLoc = endLoc - periods
        elif end is None:
            if not isinstance(start, Timestamp):
                raise AssertionError('start must be an instance of Timestamp')

            start = offset.rollforward(start)

            startLoc = cachedRange.get_loc(start)
            endLoc = startLoc + periods
        else:
            if not offset.onOffset(start):
                start = offset.rollforward(start)

            if not offset.onOffset(end):
                end = offset.rollback(end)

            startLoc = cachedRange.get_loc(start)
            endLoc = cachedRange.get_loc(end) + 1

        indexSlice = cachedRange[startLoc:endLoc]
        indexSlice.name = name
        indexSlice.offset = offset

        return indexSlice

    def _mpl_repr(self):
        # how to represent ourselves to matplotlib
        return libts.ints_to_pydatetime(self.asi8, self.tz)

    @cache_readonly
    def _is_dates_only(self):
        from pandas.io.formats.format import _is_dates_only
        return _is_dates_only(self.values)

    @property
    def _formatter_func(self):
        from pandas.io.formats.format import _get_format_datetime64
        formatter = _get_format_datetime64(is_dates_only=self._is_dates_only)
        return lambda x: "'%s'" % formatter(x, tz=self.tz)

    def __reduce__(self):

        # we use a special reudce here because we need
        # to simply set the .tz (and not reinterpret it)

        d = dict(data=self._data)
        d.update(self._get_attributes_dict())
        return _new_DatetimeIndex, (self.__class__, d), None

    def __setstate__(self, state):
        """Necessary for making this object picklable"""
        if isinstance(state, dict):
            super(DatetimeIndex, self).__setstate__(state)

        elif isinstance(state, tuple):

            # < 0.15 compat
            if len(state) == 2:
                nd_state, own_state = state
                data = np.empty(nd_state[1], dtype=nd_state[2])
                np.ndarray.__setstate__(data, nd_state)

                self.name = own_state[0]
                self.offset = own_state[1]
                self.tz = own_state[2]

                # provide numpy < 1.7 compat
                if nd_state[2] == 'M8[us]':
                    new_state = np.ndarray.__reduce__(data.astype('M8[ns]'))
                    np.ndarray.__setstate__(data, new_state[2])

            else:  # pragma: no cover
                data = np.empty(state)
                np.ndarray.__setstate__(data, state)

            self._data = data
            self._reset_identity()

        else:
            raise Exception("invalid pickle state")
    _unpickle_compat = __setstate__

    def _add_datelike(self, other):
        # adding a timedeltaindex to a datetimelike
        if other is libts.NaT:
            return self._nat_new(box=True)
        raise TypeError("cannot add a datelike to a DatetimeIndex")

    def _sub_datelike(self, other):
        # subtract a datetime from myself, yielding a TimedeltaIndex
        from pandas import TimedeltaIndex
        if isinstance(other, DatetimeIndex):
            # require tz compat
            if not self._has_same_tz(other):
                raise TypeError("DatetimeIndex subtraction must have the same "
                                "timezones or no timezones")
            result = self._sub_datelike_dti(other)
        elif isinstance(other, (libts.Timestamp, datetime)):
            other = Timestamp(other)
            if other is libts.NaT:
                result = self._nat_new(box=False)
            # require tz compat
            elif not self._has_same_tz(other):
                raise TypeError("Timestamp subtraction must have the same "
                                "timezones or no timezones")
            else:
                i8 = self.asi8
                result = i8 - other.value
                result = self._maybe_mask_results(result,
                                                  fill_value=libts.iNaT)
        else:
            raise TypeError("cannot subtract DatetimeIndex and {typ}"
                            .format(typ=type(other).__name__))
        return TimedeltaIndex(result, name=self.name, copy=False)

    def _sub_datelike_dti(self, other):
        """subtraction of two DatetimeIndexes"""
        if not len(self) == len(other):
            raise ValueError("cannot add indices of unequal length")

        self_i8 = self.asi8
        other_i8 = other.asi8
        new_values = self_i8 - other_i8
        if self.hasnans or other.hasnans:
            mask = (self._isnan) | (other._isnan)
            new_values[mask] = libts.iNaT
        return new_values.view('i8')

    def _maybe_update_attributes(self, attrs):
        """ Update Index attributes (e.g. freq) depending on op """
        freq = attrs.get('freq', None)
        if freq is not None:
            # no need to infer if freq is None
            attrs['freq'] = 'infer'
        return attrs

    def _add_delta(self, delta):
        from pandas import TimedeltaIndex
        name = self.name

        if isinstance(delta, (Tick, timedelta, np.timedelta64)):
            new_values = self._add_delta_td(delta)
        elif isinstance(delta, TimedeltaIndex):
            new_values = self._add_delta_tdi(delta)
            # update name when delta is Index
            name = com._maybe_match_name(self, delta)
        elif isinstance(delta, DateOffset):
            new_values = self._add_offset(delta).asi8
        else:
            new_values = self.astype('O') + delta

        tz = 'UTC' if self.tz is not None else None
        result = DatetimeIndex(new_values, tz=tz, name=name, freq='infer')
        utc = _utc()
        if self.tz is not None and self.tz is not utc:
            result = result.tz_convert(self.tz)
        return result

    def _add_offset(self, offset):
        try:
            if self.tz is not None:
                values = self.tz_localize(None)
            else:
                values = self
            result = offset.apply_index(values)
            if self.tz is not None:
                result = result.tz_localize(self.tz)
            return result

        except NotImplementedError:
            warnings.warn("Non-vectorized DateOffset being applied to Series "
                          "or DatetimeIndex", PerformanceWarning)
            return self.astype('O') + offset

    def _format_native_types(self, na_rep='NaT', date_format=None, **kwargs):
        from pandas.io.formats.format import _get_format_datetime64_from_values
        format = _get_format_datetime64_from_values(self, date_format)

        return libts.format_array_from_datetime(self.asi8,
                                                tz=self.tz,
                                                format=format,
                                                na_rep=na_rep)

    def to_datetime(self, dayfirst=False):
        return self.copy()

    @Appender(_index_shared_docs['astype'])
    def astype(self, dtype, copy=True):
        dtype = pandas_dtype(dtype)
        if is_object_dtype(dtype):
            return self.asobject
        elif is_integer_dtype(dtype):
            return Index(self.values.astype('i8', copy=copy), name=self.name,
                         dtype='i8')
        elif is_datetime64_ns_dtype(dtype):
            if self.tz is not None:
                return self.tz_convert('UTC').tz_localize(None)
            elif copy is True:
                return self.copy()
            return self
        elif is_string_dtype(dtype):
            return Index(self.format(), name=self.name, dtype=object)
        elif is_period_dtype(dtype):
            return self.to_period(freq=dtype.freq)
        raise ValueError('Cannot cast DatetimeIndex to dtype %s' % dtype)

    def _get_time_micros(self):
        utc = _utc()
        values = self.asi8
        if self.tz is not None and self.tz is not utc:
            values = self._local_timestamps()
        return libts.get_time_micros(values)

    def to_series(self, keep_tz=False):
        """
        Create a Series with both index and values equal to the index keys
        useful with map for returning an indexer based on an index

        Parameters
        ----------
        keep_tz : optional, defaults False.
            return the data keeping the timezone.

            If keep_tz is True:

              If the timezone is not set, the resulting
              Series will have a datetime64[ns] dtype.

              Otherwise the Series will have an datetime64[ns, tz] dtype; the
              tz will be preserved.

            If keep_tz is False:

              Series will have a datetime64[ns] dtype. TZ aware
              objects will have the tz removed.

        Returns
        -------
        Series
        """
        from pandas import Series
        return Series(self._to_embed(keep_tz),
                      index=self._shallow_copy(),
                      name=self.name)

    def _to_embed(self, keep_tz=False):
        """
        return an array repr of this object, potentially casting to object

        This is for internal compat
        """
        if keep_tz and self.tz is not None:

            # preserve the tz & copy
            return self.copy(deep=True)

        return self.values.copy()

    def to_pydatetime(self):
        """
        Return DatetimeIndex as object ndarray of datetime.datetime objects

        Returns
        -------
        datetimes : ndarray
        """
        return libts.ints_to_pydatetime(self.asi8, tz=self.tz)

    def to_period(self, freq=None):
        """
        Cast to PeriodIndex at a particular frequency
        """
        from pandas.core.indexes.period import PeriodIndex

        if freq is None:
            freq = self.freqstr or self.inferred_freq

            if freq is None:
                msg = ("You must pass a freq argument as "
                       "current index has none.")
                raise ValueError(msg)

            freq = get_period_alias(freq)

        return PeriodIndex(self.values, name=self.name, freq=freq, tz=self.tz)

    def snap(self, freq='S'):
        """
        Snap time stamps to nearest occurring frequency

        """
        # Superdumb, punting on any optimizing
        freq = to_offset(freq)

        snapped = np.empty(len(self), dtype=_NS_DTYPE)

        for i, v in enumerate(self):
            s = v
            if not freq.onOffset(s):
                t0 = freq.rollback(s)
                t1 = freq.rollforward(s)
                if abs(s - t0) < abs(t1 - s):
                    s = t0
                else:
                    s = t1
            snapped[i] = s

        # we know it conforms; skip check
        return DatetimeIndex(snapped, freq=freq, verify_integrity=False)

    def union(self, other):
        """
        Specialized union for DatetimeIndex objects. If combine
        overlapping ranges with the same DateOffset, will be much
        faster than Index.union

        Parameters
        ----------
        other : DatetimeIndex or array-like

        Returns
        -------
        y : Index or DatetimeIndex
        """
        self._assert_can_do_setop(other)
        if not isinstance(other, DatetimeIndex):
            try:
                other = DatetimeIndex(other)
            except TypeError:
                pass

        this, other = self._maybe_utc_convert(other)

        if this._can_fast_union(other):
            return this._fast_union(other)
        else:
            result = Index.union(this, other)
            if isinstance(result, DatetimeIndex):
                result.tz = this.tz
                if (result.freq is None and
                        (this.freq is not None or other.freq is not None)):
                    result.offset = to_offset(result.inferred_freq)
            return result

    def to_perioddelta(self, freq):
        """
        Calcuates TimedeltaIndex of difference between index
        values and index converted to PeriodIndex at specified
        freq.  Used for vectorized offsets

        .. versionadded:: 0.17.0

        Parameters
        ----------
        freq : Period frequency

        Returns
        -------
        y : TimedeltaIndex
        """
        return to_timedelta(self.asi8 - self.to_period(freq)
                            .to_timestamp().asi8)

    def union_many(self, others):
        """
        A bit of a hack to accelerate unioning a collection of indexes
        """
        this = self

        for other in others:
            if not isinstance(this, DatetimeIndex):
                this = Index.union(this, other)
                continue

            if not isinstance(other, DatetimeIndex):
                try:
                    other = DatetimeIndex(other)
                except TypeError:
                    pass

            this, other = this._maybe_utc_convert(other)

            if this._can_fast_union(other):
                this = this._fast_union(other)
            else:
                tz = this.tz
                this = Index.union(this, other)
                if isinstance(this, DatetimeIndex):
                    this.tz = tz

        if this.freq is None:
            this.offset = to_offset(this.inferred_freq)
        return this

    def join(self, other, how='left', level=None, return_indexers=False,
             sort=False):
        """
        See Index.join
        """
        if (not isinstance(other, DatetimeIndex) and len(other) > 0 and
            other.inferred_type not in ('floating', 'mixed-integer',
                                        'mixed-integer-float', 'mixed')):
            try:
                other = DatetimeIndex(other)
            except (TypeError, ValueError):
                pass

        this, other = self._maybe_utc_convert(other)
        return Index.join(this, other, how=how, level=level,
                          return_indexers=return_indexers, sort=sort)

    def _maybe_utc_convert(self, other):
        this = self
        if isinstance(other, DatetimeIndex):
            if self.tz is not None:
                if other.tz is None:
                    raise TypeError('Cannot join tz-naive with tz-aware '
                                    'DatetimeIndex')
            elif other.tz is not None:
                raise TypeError('Cannot join tz-naive with tz-aware '
                                'DatetimeIndex')

            if self.tz != other.tz:
                this = self.tz_convert('UTC')
                other = other.tz_convert('UTC')
        return this, other

    def _wrap_joined_index(self, joined, other):
        name = self.name if self.name == other.name else None
        if (isinstance(other, DatetimeIndex) and
                self.offset == other.offset and
                self._can_fast_union(other)):
            joined = self._shallow_copy(joined)
            joined.name = name
            return joined
        else:
            tz = getattr(other, 'tz', None)
            return self._simple_new(joined, name, tz=tz)

    def _can_fast_union(self, other):
        if not isinstance(other, DatetimeIndex):
            return False

        offset = self.offset

        if offset is None or offset != other.offset:
            return False

        if not self.is_monotonic or not other.is_monotonic:
            return False

        if len(self) == 0 or len(other) == 0:
            return True

        # to make our life easier, "sort" the two ranges
        if self[0] <= other[0]:
            left, right = self, other
        else:
            left, right = other, self

        right_start = right[0]
        left_end = left[-1]

        # Only need to "adjoin", not overlap
        try:
            return (right_start == left_end + offset) or right_start in left
        except (ValueError):

            # if we are comparing an offset that does not propagate timezones
            # this will raise
            return False

    def _fast_union(self, other):
        if len(other) == 0:
            return self.view(type(self))

        if len(self) == 0:
            return other.view(type(self))

        # to make our life easier, "sort" the two ranges
        if self[0] <= other[0]:
            left, right = self, other
        else:
            left, right = other, self

        left_start, left_end = left[0], left[-1]
        right_end = right[-1]

        if not self.offset._should_cache():
            # concatenate dates
            if left_end < right_end:
                loc = right.searchsorted(left_end, side='right')
                right_chunk = right.values[loc:]
                dates = _concat._concat_compat((left.values, right_chunk))
                return self._shallow_copy(dates)
            else:
                return left
        else:
            return type(self)(start=left_start,
                              end=max(left_end, right_end),
                              freq=left.offset)

    def __iter__(self):
        """
        Return an iterator over the boxed values

        Returns
        -------
        Timestamps : ndarray
        """

        # convert in chunks of 10k for efficiency
        data = self.asi8
        l = len(self)
        chunksize = 10000
        chunks = int(l / chunksize) + 1
        for i in range(chunks):
            start_i = i * chunksize
            end_i = min((i + 1) * chunksize, l)
            converted = libts.ints_to_pydatetime(data[start_i:end_i],
                                                 tz=self.tz, freq=self.freq,
                                                 box=True)
            for v in converted:
                yield v

    def _wrap_union_result(self, other, result):
        name = self.name if self.name == other.name else None
        if self.tz != other.tz:
            raise ValueError('Passed item and index have different timezone')
        return self._simple_new(result, name=name, freq=None, tz=self.tz)

    def intersection(self, other):
        """
        Specialized intersection for DatetimeIndex objects. May be much faster
        than Index.intersection

        Parameters
        ----------
        other : DatetimeIndex or array-like

        Returns
        -------
        y : Index or DatetimeIndex
        """
        self._assert_can_do_setop(other)
        if not isinstance(other, DatetimeIndex):
            try:
                other = DatetimeIndex(other)
            except (TypeError, ValueError):
                pass
            result = Index.intersection(self, other)
            if isinstance(result, DatetimeIndex):
                if result.freq is None:
                    result.offset = to_offset(result.inferred_freq)
            return result

        elif (other.offset is None or self.offset is None or
              other.offset != self.offset or
              not other.offset.isAnchored() or
              (not self.is_monotonic or not other.is_monotonic)):
            result = Index.intersection(self, other)
            result = self._shallow_copy(result._values, name=result.name,
                                        tz=result.tz, freq=None)
            if result.freq is None:
                result.offset = to_offset(result.inferred_freq)
            return result

        if len(self) == 0:
            return self
        if len(other) == 0:
            return other
        # to make our life easier, "sort" the two ranges
        if self[0] <= other[0]:
            left, right = self, other
        else:
            left, right = other, self

        end = min(left[-1], right[-1])
        start = right[0]

        if end < start:
            return type(self)(data=[])
        else:
            lslice = slice(*left.slice_locs(start, end))
            left_chunk = left.values[lslice]
            return self._shallow_copy(left_chunk)

    def _parsed_string_to_bounds(self, reso, parsed):
        """
        Calculate datetime bounds for parsed time string and its resolution.

        Parameters
        ----------
        reso : Resolution
            Resolution provided by parsed string.
        parsed : datetime
            Datetime from parsed string.

        Returns
        -------
        lower, upper: pd.Timestamp

        """
        if reso == 'year':
            return (Timestamp(datetime(parsed.year, 1, 1), tz=self.tz),
                    Timestamp(datetime(parsed.year, 12, 31, 23,
                                       59, 59, 999999), tz=self.tz))
        elif reso == 'month':
            d = libts.monthrange(parsed.year, parsed.month)[1]
            return (Timestamp(datetime(parsed.year, parsed.month, 1),
                              tz=self.tz),
                    Timestamp(datetime(parsed.year, parsed.month, d, 23,
                                       59, 59, 999999), tz=self.tz))
        elif reso == 'quarter':
            qe = (((parsed.month - 1) + 2) % 12) + 1  # two months ahead
            d = libts.monthrange(parsed.year, qe)[1]   # at end of month
            return (Timestamp(datetime(parsed.year, parsed.month, 1),
                              tz=self.tz),
                    Timestamp(datetime(parsed.year, qe, d, 23, 59,
                                       59, 999999), tz=self.tz))
        elif reso == 'day':
            st = datetime(parsed.year, parsed.month, parsed.day)
            return (Timestamp(st, tz=self.tz),
                    Timestamp(Timestamp(st + offsets.Day(),
                                        tz=self.tz).value - 1))
        elif reso == 'hour':
            st = datetime(parsed.year, parsed.month, parsed.day,
                          hour=parsed.hour)
            return (Timestamp(st, tz=self.tz),
                    Timestamp(Timestamp(st + offsets.Hour(),
                                        tz=self.tz).value - 1))
        elif reso == 'minute':
            st = datetime(parsed.year, parsed.month, parsed.day,
                          hour=parsed.hour, minute=parsed.minute)
            return (Timestamp(st, tz=self.tz),
                    Timestamp(Timestamp(st + offsets.Minute(),
                                        tz=self.tz).value - 1))
        elif reso == 'second':
            st = datetime(parsed.year, parsed.month, parsed.day,
                          hour=parsed.hour, minute=parsed.minute,
                          second=parsed.second)
            return (Timestamp(st, tz=self.tz),
                    Timestamp(Timestamp(st + offsets.Second(),
                                        tz=self.tz).value - 1))
        elif reso == 'microsecond':
            st = datetime(parsed.year, parsed.month, parsed.day,
                          parsed.hour, parsed.minute, parsed.second,
                          parsed.microsecond)
            return (Timestamp(st, tz=self.tz), Timestamp(st, tz=self.tz))
        else:
            raise KeyError

    def _partial_date_slice(self, reso, parsed, use_lhs=True, use_rhs=True):
        is_monotonic = self.is_monotonic
        if (is_monotonic and reso in ['day', 'hour', 'minute', 'second'] and
                self._resolution >= Resolution.get_reso(reso)):
            # These resolution/monotonicity validations came from GH3931,
            # GH3452 and GH2369.

            # See also GH14826
            raise KeyError

        if reso == 'microsecond':
            # _partial_date_slice doesn't allow microsecond resolution, but
            # _parsed_string_to_bounds allows it.
            raise KeyError

        t1, t2 = self._parsed_string_to_bounds(reso, parsed)
        stamps = self.asi8

        if is_monotonic:

            # we are out of range
            if (len(stamps) and ((use_lhs and t1.value < stamps[0] and
                                  t2.value < stamps[0]) or
                                 ((use_rhs and t1.value > stamps[-1] and
                                   t2.value > stamps[-1])))):
                raise KeyError

            # a monotonic (sorted) series can be sliced
            left = stamps.searchsorted(
                t1.value, side='left') if use_lhs else None
            right = stamps.searchsorted(
                t2.value, side='right') if use_rhs else None

            return slice(left, right)

        lhs_mask = (stamps >= t1.value) if use_lhs else True
        rhs_mask = (stamps <= t2.value) if use_rhs else True

        # try to find a the dates
        return (lhs_mask & rhs_mask).nonzero()[0]

    def _maybe_promote(self, other):
        if other.inferred_type == 'date':
            other = DatetimeIndex(other)
        return self, other

    def get_value(self, series, key):
        """
        Fast lookup of value from 1-dimensional ndarray. Only use this if you
        know what you're doing
        """

        if isinstance(key, datetime):

            # needed to localize naive datetimes
            if self.tz is not None:
                key = Timestamp(key, tz=self.tz)

            return self.get_value_maybe_box(series, key)

        if isinstance(key, time):
            locs = self.indexer_at_time(key)
            return series.take(locs)

        try:
            return _maybe_box(self, Index.get_value(self, series, key),
                              series, key)
        except KeyError:
            try:
                loc = self._get_string_slice(key)
                return series[loc]
            except (TypeError, ValueError, KeyError):
                pass

            try:
                return self.get_value_maybe_box(series, key)
            except (TypeError, ValueError, KeyError):
                raise KeyError(key)

    def get_value_maybe_box(self, series, key):
        # needed to localize naive datetimes
        if self.tz is not None:
            key = Timestamp(key, tz=self.tz)
        elif not isinstance(key, Timestamp):
            key = Timestamp(key)
        values = self._engine.get_value(_values_from_object(series),
                                        key, tz=self.tz)
        return _maybe_box(self, values, series, key)

    def get_loc(self, key, method=None, tolerance=None):
        """
        Get integer location for requested label

        Returns
        -------
        loc : int
        """

        if tolerance is not None:
            # try converting tolerance now, so errors don't get swallowed by
            # the try/except clauses below
            tolerance = self._convert_tolerance(tolerance)

        if isinstance(key, datetime):
            # needed to localize naive datetimes
            key = Timestamp(key, tz=self.tz)
            return Index.get_loc(self, key, method, tolerance)

        if isinstance(key, time):
            if method is not None:
                raise NotImplementedError('cannot yet lookup inexact labels '
                                          'when key is a time object')
            return self.indexer_at_time(key)

        try:
            return Index.get_loc(self, key, method, tolerance)
        except (KeyError, ValueError, TypeError):
            try:
                return self._get_string_slice(key)
            except (TypeError, KeyError, ValueError):
                pass

            try:
                stamp = Timestamp(key, tz=self.tz)
                return Index.get_loc(self, stamp, method, tolerance)
            except (KeyError, ValueError):
                raise KeyError(key)

    def _maybe_cast_slice_bound(self, label, side, kind):
        """
        If label is a string, cast it to datetime according to resolution.

        Parameters
        ----------
        label : object
        side : {'left', 'right'}
        kind : {'ix', 'loc', 'getitem'}

        Returns
        -------
        label :  object

        Notes
        -----
        Value of `side` parameter should be validated in caller.

        """
        assert kind in ['ix', 'loc', 'getitem', None]

        if is_float(label) or isinstance(label, time) or is_integer(label):
            self._invalid_indexer('slice', label)

        if isinstance(label, compat.string_types):
            freq = getattr(self, 'freqstr',
                           getattr(self, 'inferred_freq', None))
            _, parsed, reso = parse_time_string(label, freq)
            lower, upper = self._parsed_string_to_bounds(reso, parsed)
            # lower, upper form the half-open interval:
            #   [parsed, parsed + 1 freq)
            # because label may be passed to searchsorted
            # the bounds need swapped if index is reverse sorted and has a
            # length > 1 (is_monotonic_decreasing gives True for empty
            # and length 1 index)
            if self._is_strictly_monotonic_decreasing and len(self) > 1:
                return upper if side == 'left' else lower
            return lower if side == 'left' else upper
        else:
            return label

    def _get_string_slice(self, key, use_lhs=True, use_rhs=True):
        freq = getattr(self, 'freqstr',
                       getattr(self, 'inferred_freq', None))
        _, parsed, reso = parse_time_string(key, freq)
        loc = self._partial_date_slice(reso, parsed, use_lhs=use_lhs,
                                       use_rhs=use_rhs)
        return loc

    def slice_indexer(self, start=None, end=None, step=None, kind=None):
        """
        Return indexer for specified label slice.
        Index.slice_indexer, customized to handle time slicing.

        In addition to functionality provided by Index.slice_indexer, does the
        following:

        - if both `start` and `end` are instances of `datetime.time`, it
          invokes `indexer_between_time`
        - if `start` and `end` are both either string or None perform
          value-based selection in non-monotonic cases.

        """
        # For historical reasons DatetimeIndex supports slices between two
        # instances of datetime.time as if it were applying a slice mask to
        # an array of (self.hour, self.minute, self.seconds, self.microsecond).
        if isinstance(start, time) and isinstance(end, time):
            if step is not None and step != 1:
                raise ValueError('Must have step size of 1 with time slices')
            return self.indexer_between_time(start, end)

        if isinstance(start, time) or isinstance(end, time):
            raise KeyError('Cannot mix time and non-time slice keys')

        try:
            return Index.slice_indexer(self, start, end, step, kind=kind)
        except KeyError:
            # For historical reasons DatetimeIndex by default supports
            # value-based partial (aka string) slices on non-monotonic arrays,
            # let's try that.
            if ((start is None or isinstance(start, compat.string_types)) and
                    (end is None or isinstance(end, compat.string_types))):
                mask = True
                if start is not None:
                    start_casted = self._maybe_cast_slice_bound(
                        start, 'left', kind)
                    mask = start_casted <= self

                if end is not None:
                    end_casted = self._maybe_cast_slice_bound(
                        end, 'right', kind)
                    mask = (self <= end_casted) & mask

                indexer = mask.nonzero()[0][::step]
                if len(indexer) == len(self):
                    return slice(None)
                else:
                    return indexer
            else:
                raise

    # alias to offset
    def _get_freq(self):
        return self.offset

    def _set_freq(self, value):
        self.offset = value
    freq = property(fget=_get_freq, fset=_set_freq,
                    doc="get/set the frequency of the Index")

    year = _field_accessor('year', 'Y', "The year of the datetime")
    month = _field_accessor('month', 'M',
                            "The month as January=1, December=12")
    day = _field_accessor('day', 'D', "The days of the datetime")
    hour = _field_accessor('hour', 'h', "The hours of the datetime")
    minute = _field_accessor('minute', 'm', "The minutes of the datetime")
    second = _field_accessor('second', 's', "The seconds of the datetime")
    microsecond = _field_accessor('microsecond', 'us',
                                  "The microseconds of the datetime")
    nanosecond = _field_accessor('nanosecond', 'ns',
                                 "The nanoseconds of the datetime")
    weekofyear = _field_accessor('weekofyear', 'woy',
                                 "The week ordinal of the year")
    week = weekofyear
    dayofweek = _field_accessor('dayofweek', 'dow',
                                "The day of the week with Monday=0, Sunday=6")
    weekday = dayofweek

    weekday_name = _field_accessor(
        'weekday_name',
        'weekday_name',
        "The name of day in a week (ex: Friday)\n\n.. versionadded:: 0.18.1")

    dayofyear = _field_accessor('dayofyear', 'doy',
                                "The ordinal day of the year")
    quarter = _field_accessor('quarter', 'q', "The quarter of the date")
    days_in_month = _field_accessor(
        'days_in_month',
        'dim',
        "The number of days in the month\n\n.. versionadded:: 0.16.0")
    daysinmonth = days_in_month
    is_month_start = _field_accessor(
        'is_month_start',
        'is_month_start',
        "Logical indicating if first day of month (defined by frequency)")
    is_month_end = _field_accessor(
        'is_month_end',
        'is_month_end',
        "Logical indicating if last day of month (defined by frequency)")
    is_quarter_start = _field_accessor(
        'is_quarter_start',
        'is_quarter_start',
        "Logical indicating if first day of quarter (defined by frequency)")
    is_quarter_end = _field_accessor(
        'is_quarter_end',
        'is_quarter_end',
        "Logical indicating if last day of quarter (defined by frequency)")
    is_year_start = _field_accessor(
        'is_year_start',
        'is_year_start',
        "Logical indicating if first day of year (defined by frequency)")
    is_year_end = _field_accessor(
        'is_year_end',
        'is_year_end',
        "Logical indicating if last day of year (defined by frequency)")
    is_leap_year = _field_accessor(
        'is_leap_year',
        'is_leap_year',
        "Logical indicating if the date belongs to a leap year")

    @property
    def time(self):
        """
        Returns numpy array of datetime.time. The time part of the Timestamps.
        """
        return self._maybe_mask_results(libalgos.arrmap_object(
            self.asobject.values,
            lambda x: np.nan if x is libts.NaT else x.time()))

    @property
    def date(self):
        """
        Returns numpy array of python datetime.date objects (namely, the date
        part of Timestamps without timezone information).
        """
        return self._maybe_mask_results(libalgos.arrmap_object(
            self.asobject.values, lambda x: x.date()))

    def normalize(self):
        """
        Return DatetimeIndex with times to midnight. Length is unaltered

        Returns
        -------
        normalized : DatetimeIndex
        """
        new_values = libts.date_normalize(self.asi8, self.tz)
        return DatetimeIndex(new_values, freq='infer', name=self.name,
                             tz=self.tz)

    @Substitution(klass='DatetimeIndex')
    @Appender(_shared_docs['searchsorted'])
    @deprecate_kwarg(old_arg_name='key', new_arg_name='value')
    def searchsorted(self, value, side='left', sorter=None):
        if isinstance(value, (np.ndarray, Index)):
            value = np.array(value, dtype=_NS_DTYPE, copy=False)
        else:
            value = _to_m8(value, tz=self.tz)

        return self.values.searchsorted(value, side=side)

    def is_type_compatible(self, typ):
        return typ == self.inferred_type or typ == 'datetime'

    @property
    def inferred_type(self):
        # b/c datetime is represented as microseconds since the epoch, make
        # sure we can't have ambiguous indexing
        return 'datetime64'

    @cache_readonly
    def dtype(self):
        if self.tz is None:
            return _NS_DTYPE
        return DatetimeTZDtype('ns', self.tz)

    @property
    def is_all_dates(self):
        return True

    @cache_readonly
    def is_normalized(self):
        """
        Returns True if all of the dates are at midnight ("no time")
        """
        return libts.dates_normalized(self.asi8, self.tz)

    @cache_readonly
    def _resolution(self):
        return libperiod.resolution(self.asi8, self.tz)

    def insert(self, loc, item):
        """
        Make new Index inserting new item at location

        Parameters
        ----------
        loc : int
        item : object
            if not either a Python datetime or a numpy integer-like, returned
            Index dtype will be object rather than datetime.

        Returns
        -------
        new_index : Index
        """

        freq = None

        if isinstance(item, (datetime, np.datetime64)):
            self._assert_can_do_op(item)
            if not self._has_same_tz(item):
                raise ValueError(
                    'Passed item and index have different timezone')
            # check freq can be preserved on edge cases
            if self.size and self.freq is not None:
                if ((loc == 0 or loc == -len(self)) and
                        item + self.freq == self[0]):
                    freq = self.freq
                elif (loc == len(self)) and item - self.freq == self[-1]:
                    freq = self.freq
            item = _to_m8(item, tz=self.tz)
        try:
            new_dates = np.concatenate((self[:loc].asi8, [item.view(np.int64)],
                                        self[loc:].asi8))
            if self.tz is not None:
                new_dates = libts.tz_convert(new_dates, 'UTC', self.tz)
            return DatetimeIndex(new_dates, name=self.name, freq=freq,
                                 tz=self.tz)

        except (AttributeError, TypeError):

            # fall back to object index
            if isinstance(item, compat.string_types):
                return self.asobject.insert(loc, item)
            raise TypeError(
                "cannot insert DatetimeIndex with incompatible label")

    def delete(self, loc):
        """
        Make a new DatetimeIndex with passed location(s) deleted.

        Parameters
        ----------
        loc: int, slice or array of ints
            Indicate which sub-arrays to remove.

        Returns
        -------
        new_index : DatetimeIndex
        """
        new_dates = np.delete(self.asi8, loc)

        freq = None
        if is_integer(loc):
            if loc in (0, -len(self), -1, len(self) - 1):
                freq = self.freq
        else:
            if is_list_like(loc):
                loc = lib.maybe_indices_to_slice(
                    _ensure_int64(np.array(loc)), len(self))
            if isinstance(loc, slice) and loc.step in (1, None):
                if (loc.start in (0, None) or loc.stop in (len(self), None)):
                    freq = self.freq

        if self.tz is not None:
            new_dates = libts.tz_convert(new_dates, 'UTC', self.tz)
        return DatetimeIndex(new_dates, name=self.name, freq=freq, tz=self.tz)

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

        Raises
        ------
        TypeError
            If DatetimeIndex is tz-naive.
        """
        tz = libts.maybe_get_tz(tz)

        if self.tz is None:
            # tz naive, use tz_localize
            raise TypeError('Cannot convert tz-naive timestamps, use '
                            'tz_localize to localize')

        # No conversion since timestamps are all UTC to begin with
        return self._shallow_copy(tz=tz)

    @deprecate_kwarg(old_arg_name='infer_dst', new_arg_name='ambiguous',
                     mapping={True: 'infer', False: 'raise'})
    def tz_localize(self, tz, ambiguous='raise', errors='raise'):
        """
        Localize tz-naive DatetimeIndex to given time zone (using
        pytz/dateutil), or remove timezone from tz-aware DatetimeIndex

        Parameters
        ----------
        tz : string, pytz.timezone, dateutil.tz.tzfile or None
            Time zone for time. Corresponding timestamps would be converted to
            time zone of the TimeSeries.
            None will remove timezone holding local time.
        ambiguous : 'infer', bool-ndarray, 'NaT', default 'raise'
            - 'infer' will attempt to infer fall dst-transition hours based on
              order
            - bool-ndarray where True signifies a DST time, False signifies a
              non-DST time (note that this flag is only applicable for
              ambiguous times)
            - 'NaT' will return NaT where there are ambiguous times
            - 'raise' will raise an AmbiguousTimeError if there are ambiguous
              times
        errors : 'raise', 'coerce', default 'raise'
            - 'raise' will raise a NonExistentTimeError if a timestamp is not
               valid in the specified timezone (e.g. due to a transition from
               or to DST time)
            - 'coerce' will return NaT if the timestamp can not be converted
              into the specified timezone

            .. versionadded:: 0.19.0

        infer_dst : boolean, default False (DEPRECATED)
            Attempt to infer fall dst-transition hours based on order

        Returns
        -------
        localized : DatetimeIndex

        Raises
        ------
        TypeError
            If the DatetimeIndex is tz-aware and tz is not None.
        """
        if self.tz is not None:
            if tz is None:
                new_dates = libts.tz_convert(self.asi8, 'UTC', self.tz)
            else:
                raise TypeError("Already tz-aware, use tz_convert to convert.")
        else:
            tz = libts.maybe_get_tz(tz)
            # Convert to UTC

            new_dates = libts.tz_localize_to_utc(self.asi8, tz,
                                                 ambiguous=ambiguous,
                                                 errors=errors)
        new_dates = new_dates.view(_NS_DTYPE)
        return self._shallow_copy(new_dates, tz=tz)

    def indexer_at_time(self, time, asof=False):
        """
        Select values at particular time of day (e.g. 9:30AM)

        Parameters
        ----------
        time : datetime.time or string

        Returns
        -------
        values_at_time : TimeSeries
        """
        from dateutil.parser import parse

        if asof:
            raise NotImplementedError("'asof' argument is not supported")

        if isinstance(time, compat.string_types):
            time = parse(time).time()

        if time.tzinfo:
            # TODO
            raise NotImplementedError("argument 'time' with timezone info is "
                                      "not supported")

        time_micros = self._get_time_micros()
        micros = _time_to_micros(time)
        return (micros == time_micros).nonzero()[0]

    def indexer_between_time(self, start_time, end_time, include_start=True,
                             include_end=True):
        """
        Select values between particular times of day (e.g., 9:00-9:30AM).

        Return values of the index between two times.  If start_time or
        end_time are strings then tseres.tools.to_time is used to convert to
        a time object.

        Parameters
        ----------
        start_time, end_time : datetime.time, str
            datetime.time or string in appropriate format ("%H:%M", "%H%M",
            "%I:%M%p", "%I%M%p", "%H:%M:%S", "%H%M%S", "%I:%M:%S%p",
            "%I%M%S%p")
        include_start : boolean, default True
        include_end : boolean, default True

        Returns
        -------
        values_between_time : TimeSeries
        """
        start_time = to_time(start_time)
        end_time = to_time(end_time)
        time_micros = self._get_time_micros()
        start_micros = _time_to_micros(start_time)
        end_micros = _time_to_micros(end_time)

        if include_start and include_end:
            lop = rop = operator.le
        elif include_start:
            lop = operator.le
            rop = operator.lt
        elif include_end:
            lop = operator.lt
            rop = operator.le
        else:
            lop = rop = operator.lt

        if start_time <= end_time:
            join_op = operator.and_
        else:
            join_op = operator.or_

        mask = join_op(lop(start_micros, time_micros),
                       rop(time_micros, end_micros))

        return mask.nonzero()[0]

    def to_julian_date(self):
        """
        Convert DatetimeIndex to Float64Index of Julian Dates.
        0 Julian date is noon January 1, 4713 BC.
        http://en.wikipedia.org/wiki/Julian_day
        """

        # http://mysite.verizon.net/aesir_research/date/jdalg2.htm
        year = np.asarray(self.year)
        month = np.asarray(self.month)
        day = np.asarray(self.day)
        testarr = month < 3
        year[testarr] -= 1
        month[testarr] += 12
        return Float64Index(day +
                            np.fix((153 * month - 457) / 5) +
                            365 * year +
                            np.floor(year / 4) -
                            np.floor(year / 100) +
                            np.floor(year / 400) +
                            1721118.5 +
                            (self.hour +
                             self.minute / 60.0 +
                             self.second / 3600.0 +
                             self.microsecond / 3600.0 / 1e+6 +
                             self.nanosecond / 3600.0 / 1e+9
                             ) / 24.0)


DatetimeIndex._add_numeric_methods_disabled()
DatetimeIndex._add_logical_methods_disabled()
DatetimeIndex._add_datetimelike_methods()


def _generate_regular_range(start, end, periods, offset):
    if isinstance(offset, Tick):
        stride = offset.nanos
        if periods is None:
            b = Timestamp(start).value
            # cannot just use e = Timestamp(end) + 1 because arange breaks when
            # stride is too large, see GH10887
            e = (b + (Timestamp(end).value - b) // stride * stride +
                 stride // 2 + 1)
            # end.tz == start.tz by this point due to _generate implementation
            tz = start.tz
        elif start is not None:
            b = Timestamp(start).value
            e = b + np.int64(periods) * stride
            tz = start.tz
        elif end is not None:
            e = Timestamp(end).value + stride
            b = e - np.int64(periods) * stride
            tz = end.tz
        else:
            raise ValueError("at least 'start' or 'end' should be specified "
                             "if a 'period' is given.")

        data = np.arange(b, e, stride, dtype=np.int64)
        data = DatetimeIndex._simple_new(data, None, tz=tz)
    else:
        if isinstance(start, Timestamp):
            start = start.to_pydatetime()

        if isinstance(end, Timestamp):
            end = end.to_pydatetime()

        xdr = generate_range(start=start, end=end,
                             periods=periods, offset=offset)

        dates = list(xdr)
        # utc = len(dates) > 0 and dates[0].tzinfo is not None
        data = tools.to_datetime(dates)

    return data


def date_range(start=None, end=None, periods=None, freq='D', tz=None,
               normalize=False, name=None, closed=None, **kwargs):
    """
    Return a fixed frequency datetime index, with day (calendar) as the default
    frequency

    Parameters
    ----------
    start : string or datetime-like, default None
        Left bound for generating dates
    end : string or datetime-like, default None
        Right bound for generating dates
    periods : integer or None, default None
        If None, must specify start and end
    freq : string or DateOffset, default 'D' (calendar daily)
        Frequency strings can have multiples, e.g. '5H'
    tz : string or None
        Time zone name for returning localized DatetimeIndex, for example
        Asia/Hong_Kong
    normalize : bool, default False
        Normalize start/end dates to midnight before generating date range
    name : str, default None
        Name of the resulting index
    closed : string or None, default None
        Make the interval closed with respect to the given frequency to
        the 'left', 'right', or both sides (None)

    Notes
    -----
    2 of start, end, or periods must be specified

    To learn more about the frequency strings, please see `this link
    <http://pandas.pydata.org/pandas-docs/stable/timeseries.html#offset-aliases>`__.

    Returns
    -------
    rng : DatetimeIndex
    """
    return DatetimeIndex(start=start, end=end, periods=periods,
                         freq=freq, tz=tz, normalize=normalize, name=name,
                         closed=closed, **kwargs)


def bdate_range(start=None, end=None, periods=None, freq='B', tz=None,
                normalize=True, name=None, closed=None, **kwargs):
    """
    Return a fixed frequency datetime index, with business day as the default
    frequency

    Parameters
    ----------
    start : string or datetime-like, default None
        Left bound for generating dates
    end : string or datetime-like, default None
        Right bound for generating dates
    periods : integer or None, default None
        If None, must specify start and end
    freq : string or DateOffset, default 'B' (business daily)
        Frequency strings can have multiples, e.g. '5H'
    tz : string or None
        Time zone name for returning localized DatetimeIndex, for example
        Asia/Beijing
    normalize : bool, default False
        Normalize start/end dates to midnight before generating date range
    name : str, default None
        Name for the resulting index
    closed : string or None, default None
        Make the interval closed with respect to the given frequency to
        the 'left', 'right', or both sides (None)

    Notes
    -----
    2 of start, end, or periods must be specified

    To learn more about the frequency strings, please see `this link
    <http://pandas.pydata.org/pandas-docs/stable/timeseries.html#offset-aliases>`__.

    Returns
    -------
    rng : DatetimeIndex
    """

    return DatetimeIndex(start=start, end=end, periods=periods,
                         freq=freq, tz=tz, normalize=normalize, name=name,
                         closed=closed, **kwargs)


def cdate_range(start=None, end=None, periods=None, freq='C', tz=None,
                normalize=True, name=None, closed=None, **kwargs):
    """
    **EXPERIMENTAL** Return a fixed frequency datetime index, with
    CustomBusinessDay as the default frequency

    .. warning:: EXPERIMENTAL

        The CustomBusinessDay class is not officially supported and the API is
        likely to change in future versions. Use this at your own risk.

    Parameters
    ----------
    start : string or datetime-like, default None
        Left bound for generating dates
    end : string or datetime-like, default None
        Right bound for generating dates
    periods : integer or None, default None
        If None, must specify start and end
    freq : string or DateOffset, default 'C' (CustomBusinessDay)
        Frequency strings can have multiples, e.g. '5H'
    tz : string or None
        Time zone name for returning localized DatetimeIndex, for example
        Asia/Beijing
    normalize : bool, default False
        Normalize start/end dates to midnight before generating date range
    name : str, default None
        Name for the resulting index
    weekmask : str, Default 'Mon Tue Wed Thu Fri'
        weekmask of valid business days, passed to ``numpy.busdaycalendar``
    holidays : list
        list/array of dates to exclude from the set of valid business days,
        passed to ``numpy.busdaycalendar``
    closed : string or None, default None
        Make the interval closed with respect to the given frequency to
        the 'left', 'right', or both sides (None)

    Notes
    -----
    2 of start, end, or periods must be specified

    To learn more about the frequency strings, please see `this link
    <http://pandas.pydata.org/pandas-docs/stable/timeseries.html#offset-aliases>`__.

    Returns
    -------
    rng : DatetimeIndex
    """

    if freq == 'C':
        holidays = kwargs.pop('holidays', [])
        weekmask = kwargs.pop('weekmask', 'Mon Tue Wed Thu Fri')
        freq = CDay(holidays=holidays, weekmask=weekmask)
    return DatetimeIndex(start=start, end=end, periods=periods, freq=freq,
                         tz=tz, normalize=normalize, name=name,
                         closed=closed, **kwargs)


def _to_m8(key, tz=None):
    """
    Timestamp-like => dt64
    """
    if not isinstance(key, Timestamp):
        # this also converts strings
        key = Timestamp(key, tz=tz)

    return np.int64(libts.pydt_to_i8(key)).view(_NS_DTYPE)


_CACHE_START = Timestamp(datetime(1950, 1, 1))
_CACHE_END = Timestamp(datetime(2030, 1, 1))

_daterange_cache = {}


def _naive_in_cache_range(start, end):
    if start is None or end is None:
        return False
    else:
        if start.tzinfo is not None or end.tzinfo is not None:
            return False
        return _in_range(start, end, _CACHE_START, _CACHE_END)


def _in_range(start, end, rng_start, rng_end):
    return start > rng_start and end < rng_end


def _use_cached_range(offset, _normalized, start, end):
    return (offset._should_cache() and
            not (offset._normalize_cache and not _normalized) and
            _naive_in_cache_range(start, end))


def _time_to_micros(time):
    seconds = time.hour * 60 * 60 + 60 * time.minute + time.second
    return 1000000 * seconds + time.microsecond
