"""
Base and utility classes for tseries type pandas objects.
"""
import warnings

from datetime import datetime, timedelta

from pandas import compat
from pandas.compat.numpy import function as nv

import numpy as np
from pandas.core.dtypes.common import (
    is_integer, is_float,
    is_bool_dtype, _ensure_int64,
    is_scalar, is_dtype_equal,
    is_list_like)
from pandas.core.dtypes.generic import (
    ABCIndex, ABCSeries,
    ABCPeriodIndex, ABCIndexClass)
from pandas.core.dtypes.missing import isnull
from pandas.core import common as com, algorithms
from pandas.core.algorithms import checked_add_with_arr
from pandas.core.common import AbstractMethodError

import pandas.io.formats.printing as printing
from pandas._libs import (tslib as libts, lib,
                          Timedelta, Timestamp, iNaT, NaT)
from pandas._libs.period import Period

from pandas.core.indexes.base import Index, _index_shared_docs
from pandas.util._decorators import Appender, cache_readonly
import pandas.core.dtypes.concat as _concat
import pandas.tseries.frequencies as frequencies

import pandas.core.indexes.base as ibase
_index_doc_kwargs = dict(ibase._index_doc_kwargs)


class DatelikeOps(object):
    """ common ops for DatetimeIndex/PeriodIndex, but not TimedeltaIndex """

    def strftime(self, date_format):
        return np.asarray(self.format(date_format=date_format),
                          dtype=compat.text_type)
    strftime.__doc__ = """
    Return an array of formatted strings specified by date_format, which
    supports the same string format as the python standard library. Details
    of the string format can be found in `python string format doc <{0}>`__

    .. versionadded:: 0.17.0

    Parameters
    ----------
    date_format : str
        date format string (e.g. "%Y-%m-%d")

    Returns
    -------
    ndarray of formatted strings
    """.format("https://docs.python.org/2/library/datetime.html"
               "#strftime-and-strptime-behavior")


class TimelikeOps(object):
    """ common ops for TimedeltaIndex/DatetimeIndex, but not PeriodIndex """

    _round_doc = (
        """
        %s the index to the specified freq

        Parameters
        ----------
        freq : freq string/object

        Returns
        -------
        index of same type

        Raises
        ------
        ValueError if the freq cannot be converted
        """)

    def _round(self, freq, rounder):

        from pandas.tseries.frequencies import to_offset
        unit = to_offset(freq).nanos
        # round the local times
        values = _ensure_datetimelike_to_i8(self)
        if unit < 1000 and unit % 1000 != 0:
            # for nano rounding, work with the last 6 digits separately
            # due to float precision
            buff = 1000000
            result = (buff * (values // buff) + unit *
                      (rounder((values % buff) / float(unit))).astype('i8'))
        elif unit >= 1000 and unit % 1000 != 0:
            msg = 'Precision will be lost using frequency: {}'
            warnings.warn(msg.format(freq))
            result = (unit * rounder(values / float(unit)).astype('i8'))
        else:
            result = (unit * rounder(values / float(unit)).astype('i8'))
        result = self._maybe_mask_results(result, fill_value=NaT)

        attribs = self._get_attributes_dict()
        if 'freq' in attribs:
            attribs['freq'] = None
        if 'tz' in attribs:
            attribs['tz'] = None
        return self._ensure_localized(
            self._shallow_copy(result, **attribs))

    @Appender(_round_doc % "round")
    def round(self, freq, *args, **kwargs):
        return self._round(freq, np.round)

    @Appender(_round_doc % "floor")
    def floor(self, freq):
        return self._round(freq, np.floor)

    @Appender(_round_doc % "ceil")
    def ceil(self, freq):
        return self._round(freq, np.ceil)


class DatetimeIndexOpsMixin(object):
    """ common ops mixin to support a unified inteface datetimelike Index """

    def equals(self, other):
        """
        Determines if two Index objects contain the same elements.
        """
        if self.is_(other):
            return True

        if not isinstance(other, ABCIndexClass):
            return False
        elif not isinstance(other, type(self)):
            try:
                other = type(self)(other)
            except:
                return False

        if not is_dtype_equal(self.dtype, other.dtype):
            # have different timezone
            return False

        # ToDo: Remove this when PeriodDtype is added
        elif isinstance(self, ABCPeriodIndex):
            if not isinstance(other, ABCPeriodIndex):
                return False
            if self.freq != other.freq:
                return False

        return np.array_equal(self.asi8, other.asi8)

    def __iter__(self):
        return (self._box_func(v) for v in self.asi8)

    @staticmethod
    def _join_i8_wrapper(joinf, dtype, with_indexers=True):
        """ create the join wrapper methods """

        @staticmethod
        def wrapper(left, right):
            if isinstance(left, (np.ndarray, ABCIndex, ABCSeries)):
                left = left.view('i8')
            if isinstance(right, (np.ndarray, ABCIndex, ABCSeries)):
                right = right.view('i8')
            results = joinf(left, right)
            if with_indexers:
                join_index, left_indexer, right_indexer = results
                join_index = join_index.view(dtype)
                return join_index, left_indexer, right_indexer
            return results

        return wrapper

    def _evaluate_compare(self, other, op):
        """
        We have been called because a comparison between
        8 aware arrays. numpy >= 1.11 will
        now warn about NaT comparisons
        """

        # coerce to a similar object
        if not isinstance(other, type(self)):
            if not is_list_like(other):
                # scalar
                other = [other]
            elif is_scalar(lib.item_from_zerodim(other)):
                # ndarray scalar
                other = [other.item()]
            other = type(self)(other)

        # compare
        result = op(self.asi8, other.asi8)

        # technically we could support bool dtyped Index
        # for now just return the indexing array directly
        mask = (self._isnan) | (other._isnan)
        if is_bool_dtype(result):
            result[mask] = False
            return result
        try:
            result[mask] = iNaT
            return Index(result)
        except TypeError:
            return result

    def _ensure_localized(self, result):
        """
        ensure that we are re-localized

        This is for compat as we can then call this on all datetimelike
        indexes generally (ignored for Period/Timedelta)

        Parameters
        ----------
        result : DatetimeIndex / i8 ndarray

        Returns
        -------
        localized DTI
        """

        # reconvert to local tz
        if getattr(self, 'tz', None) is not None:
            if not isinstance(result, ABCIndexClass):
                result = self._simple_new(result)
            result = result.tz_localize(self.tz)
        return result

    @property
    def _box_func(self):
        """
        box function to get object from internal representation
        """
        raise AbstractMethodError(self)

    def _box_values(self, values):
        """
        apply box func to passed values
        """
        return lib.map_infer(values, self._box_func)

    def _format_with_header(self, header, **kwargs):
        return header + list(self._format_native_types(**kwargs))

    @Appender(_index_shared_docs['__contains__'] % _index_doc_kwargs)
    def __contains__(self, key):
        try:
            res = self.get_loc(key)
            return is_scalar(res) or type(res) == slice or np.any(res)
        except (KeyError, TypeError, ValueError):
            return False

    contains = __contains__

    def __getitem__(self, key):
        """
        This getitem defers to the underlying array, which by-definition can
        only handle list-likes, slices, and integer scalars
        """

        is_int = is_integer(key)
        if is_scalar(key) and not is_int:
            raise ValueError

        getitem = self._data.__getitem__
        if is_int:
            val = getitem(key)
            return self._box_func(val)
        else:
            if com.is_bool_indexer(key):
                key = np.asarray(key)
                if key.all():
                    key = slice(0, None, None)
                else:
                    key = lib.maybe_booleans_to_slice(key.view(np.uint8))

            attribs = self._get_attributes_dict()

            is_period = isinstance(self, ABCPeriodIndex)
            if is_period:
                freq = self.freq
            else:
                freq = None
                if isinstance(key, slice):
                    if self.freq is not None and key.step is not None:
                        freq = key.step * self.freq
                    else:
                        freq = self.freq

            attribs['freq'] = freq

            result = getitem(key)
            if result.ndim > 1:
                # To support MPL which performs slicing with 2 dim
                # even though it only has 1 dim by definition
                if is_period:
                    return self._simple_new(result, **attribs)
                return result

            return self._simple_new(result, **attribs)

    @property
    def freqstr(self):
        """
        Return the frequency object as a string if its set, otherwise None
        """
        if self.freq is None:
            return None
        return self.freq.freqstr

    @cache_readonly
    def inferred_freq(self):
        """
        Trys to return a string representing a frequency guess,
        generated by infer_freq.  Returns None if it can't autodetect the
        frequency.
        """
        try:
            return frequencies.infer_freq(self)
        except ValueError:
            return None

    def _nat_new(self, box=True):
        """
        Return Index or ndarray filled with NaT which has the same
        length as the caller.

        Parameters
        ----------
        box : boolean, default True
            - If True returns a Index as the same as caller.
            - If False returns ndarray of np.int64.
        """
        result = np.zeros(len(self), dtype=np.int64)
        result.fill(iNaT)
        if not box:
            return result

        attribs = self._get_attributes_dict()
        if not isinstance(self, ABCPeriodIndex):
            attribs['freq'] = None
        return self._simple_new(result, **attribs)

    # Try to run function on index first, and then on elements of index
    # Especially important for group-by functionality
    def map(self, f):
        try:
            result = f(self)

            # Try to use this result if we can
            if isinstance(result, np.ndarray):
                self._shallow_copy(result)

            if not isinstance(result, Index):
                raise TypeError('The map function must return an Index object')
            return result
        except Exception:
            return self.asobject.map(f)

    def sort_values(self, return_indexer=False, ascending=True):
        """
        Return sorted copy of Index
        """
        if return_indexer:
            _as = self.argsort()
            if not ascending:
                _as = _as[::-1]
            sorted_index = self.take(_as)
            return sorted_index, _as
        else:
            sorted_values = np.sort(self._values)
            attribs = self._get_attributes_dict()
            freq = attribs['freq']

            if freq is not None and not isinstance(self, ABCPeriodIndex):
                if freq.n > 0 and not ascending:
                    freq = freq * -1
                elif freq.n < 0 and ascending:
                    freq = freq * -1
            attribs['freq'] = freq

            if not ascending:
                sorted_values = sorted_values[::-1]

            return self._simple_new(sorted_values, **attribs)

    @Appender(_index_shared_docs['take'] % _index_doc_kwargs)
    def take(self, indices, axis=0, allow_fill=True,
             fill_value=None, **kwargs):
        nv.validate_take(tuple(), kwargs)
        indices = _ensure_int64(indices)

        maybe_slice = lib.maybe_indices_to_slice(indices, len(self))
        if isinstance(maybe_slice, slice):
            return self[maybe_slice]

        taken = self._assert_take_fillable(self.asi8, indices,
                                           allow_fill=allow_fill,
                                           fill_value=fill_value,
                                           na_value=iNaT)

        # keep freq in PeriodIndex, reset otherwise
        freq = self.freq if isinstance(self, ABCPeriodIndex) else None
        return self._shallow_copy(taken, freq=freq)

    def get_duplicates(self):
        values = Index.get_duplicates(self)
        return self._simple_new(values)

    _can_hold_na = True

    _na_value = NaT
    """The expected NA value to use with this index."""

    @cache_readonly
    def _isnan(self):
        """ return if each value is nan"""
        return (self.asi8 == iNaT)

    @property
    def asobject(self):
        """
        return object Index which contains boxed values

        *this is an internal non-public method*
        """
        from pandas.core.index import Index
        return Index(self._box_values(self.asi8), name=self.name, dtype=object)

    def _convert_tolerance(self, tolerance):
        try:
            return Timedelta(tolerance).to_timedelta64()
        except ValueError:
            raise ValueError('tolerance argument for %s must be convertible '
                             'to Timedelta: %r'
                             % (type(self).__name__, tolerance))

    def _maybe_mask_results(self, result, fill_value=None, convert=None):
        """
        Parameters
        ----------
        result : a ndarray
        convert : string/dtype or None

        Returns
        -------
        result : ndarray with values replace by the fill_value

        mask the result if needed, convert to the provided dtype if its not
        None

        This is an internal routine
        """

        if self.hasnans:
            if convert:
                result = result.astype(convert)
            if fill_value is None:
                fill_value = np.nan
            result[self._isnan] = fill_value
        return result

    def tolist(self):
        """
        return a list of the underlying data
        """
        return list(self.asobject)

    def min(self, axis=None, *args, **kwargs):
        """
        Return the minimum value of the Index or minimum along
        an axis.

        See also
        --------
        numpy.ndarray.min
        """
        nv.validate_min(args, kwargs)

        try:
            i8 = self.asi8

            # quick check
            if len(i8) and self.is_monotonic:
                if i8[0] != iNaT:
                    return self._box_func(i8[0])

            if self.hasnans:
                min_stamp = self[~self._isnan].asi8.min()
            else:
                min_stamp = i8.min()
            return self._box_func(min_stamp)
        except ValueError:
            return self._na_value

    def argmin(self, axis=None, *args, **kwargs):
        """
        Returns the indices of the minimum values along an axis.
        See `numpy.ndarray.argmin` for more information on the
        `axis` parameter.

        See also
        --------
        numpy.ndarray.argmin
        """
        nv.validate_argmin(args, kwargs)

        i8 = self.asi8
        if self.hasnans:
            mask = self._isnan
            if mask.all():
                return -1
            i8 = i8.copy()
            i8[mask] = np.iinfo('int64').max
        return i8.argmin()

    def max(self, axis=None, *args, **kwargs):
        """
        Return the maximum value of the Index or maximum along
        an axis.

        See also
        --------
        numpy.ndarray.max
        """
        nv.validate_max(args, kwargs)

        try:
            i8 = self.asi8

            # quick check
            if len(i8) and self.is_monotonic:
                if i8[-1] != iNaT:
                    return self._box_func(i8[-1])

            if self.hasnans:
                max_stamp = self[~self._isnan].asi8.max()
            else:
                max_stamp = i8.max()
            return self._box_func(max_stamp)
        except ValueError:
            return self._na_value

    def argmax(self, axis=None, *args, **kwargs):
        """
        Returns the indices of the maximum values along an axis.
        See `numpy.ndarray.argmax` for more information on the
        `axis` parameter.

        See also
        --------
        numpy.ndarray.argmax
        """
        nv.validate_argmax(args, kwargs)

        i8 = self.asi8
        if self.hasnans:
            mask = self._isnan
            if mask.all():
                return -1
            i8 = i8.copy()
            i8[mask] = 0
        return i8.argmax()

    @property
    def _formatter_func(self):
        raise AbstractMethodError(self)

    def _format_attrs(self):
        """
        Return a list of tuples of the (attr,formatted_value)
        """
        attrs = super(DatetimeIndexOpsMixin, self)._format_attrs()
        for attrib in self._attributes:
            if attrib == 'freq':
                freq = self.freqstr
                if freq is not None:
                    freq = "'%s'" % freq
                attrs.append(('freq', freq))
        return attrs

    @cache_readonly
    def _resolution(self):
        return frequencies.Resolution.get_reso_from_freq(self.freqstr)

    @cache_readonly
    def resolution(self):
        """
        Returns day, hour, minute, second, millisecond or microsecond
        """
        return frequencies.Resolution.get_str(self._resolution)

    def _convert_scalar_indexer(self, key, kind=None):
        """
        we don't allow integer or float indexing on datetime-like when using
        loc

        Parameters
        ----------
        key : label of the slice bound
        kind : {'ix', 'loc', 'getitem', 'iloc'} or None
        """

        assert kind in ['ix', 'loc', 'getitem', 'iloc', None]

        # we don't allow integer/float indexing for loc
        # we don't allow float indexing for ix/getitem
        if is_scalar(key):
            is_int = is_integer(key)
            is_flt = is_float(key)
            if kind in ['loc'] and (is_int or is_flt):
                self._invalid_indexer('index', key)
            elif kind in ['ix', 'getitem'] and is_flt:
                self._invalid_indexer('index', key)

        return (super(DatetimeIndexOpsMixin, self)
                ._convert_scalar_indexer(key, kind=kind))

    def _add_datelike(self, other):
        raise AbstractMethodError(self)

    def _sub_datelike(self, other):
        raise AbstractMethodError(self)

    def _sub_period(self, other):
        return NotImplemented

    @classmethod
    def _add_datetimelike_methods(cls):
        """
        add in the datetimelike methods (as we may have to override the
        superclass)
        """

        def __add__(self, other):
            from pandas.core.index import Index
            from pandas.core.indexes.timedeltas import TimedeltaIndex
            from pandas.tseries.offsets import DateOffset
            if isinstance(other, TimedeltaIndex):
                return self._add_delta(other)
            elif isinstance(self, TimedeltaIndex) and isinstance(other, Index):
                if hasattr(other, '_add_delta'):
                    return other._add_delta(self)
                raise TypeError("cannot add TimedeltaIndex and {typ}"
                                .format(typ=type(other)))
            elif isinstance(other, Index):
                raise TypeError("cannot add {typ1} and {typ2}"
                                .format(typ1=type(self).__name__,
                                        typ2=type(other).__name__))
            elif isinstance(other, (DateOffset, timedelta, np.timedelta64,
                                    Timedelta)):
                return self._add_delta(other)
            elif is_integer(other):
                return self.shift(other)
            elif isinstance(other, (Timestamp, datetime)):
                return self._add_datelike(other)
            else:  # pragma: no cover
                return NotImplemented
        cls.__add__ = __add__
        cls.__radd__ = __add__

        def __sub__(self, other):
            from pandas.core.index import Index
            from pandas.core.indexes.datetimes import DatetimeIndex
            from pandas.core.indexes.timedeltas import TimedeltaIndex
            from pandas.tseries.offsets import DateOffset
            if isinstance(other, TimedeltaIndex):
                return self._add_delta(-other)
            elif isinstance(self, TimedeltaIndex) and isinstance(other, Index):
                if not isinstance(other, TimedeltaIndex):
                    raise TypeError("cannot subtract TimedeltaIndex and {typ}"
                                    .format(typ=type(other).__name__))
                return self._add_delta(-other)
            elif isinstance(other, DatetimeIndex):
                return self._sub_datelike(other)
            elif isinstance(other, Index):
                raise TypeError("cannot subtract {typ1} and {typ2}"
                                .format(typ1=type(self).__name__,
                                        typ2=type(other).__name__))
            elif isinstance(other, (DateOffset, timedelta, np.timedelta64,
                                    Timedelta)):
                return self._add_delta(-other)
            elif is_integer(other):
                return self.shift(-other)
            elif isinstance(other, (Timestamp, datetime)):
                return self._sub_datelike(other)
            elif isinstance(other, Period):
                return self._sub_period(other)
            else:  # pragma: no cover
                return NotImplemented
        cls.__sub__ = __sub__

        def __rsub__(self, other):
            return -(self - other)
        cls.__rsub__ = __rsub__

        cls.__iadd__ = __add__
        cls.__isub__ = __sub__

    def _add_delta(self, other):
        return NotImplemented

    def _add_delta_td(self, other):
        # add a delta of a timedeltalike
        # return the i8 result view

        inc = libts._delta_to_nanoseconds(other)
        new_values = checked_add_with_arr(self.asi8, inc,
                                          arr_mask=self._isnan).view('i8')
        if self.hasnans:
            new_values[self._isnan] = iNaT
        return new_values.view('i8')

    def _add_delta_tdi(self, other):
        # add a delta of a TimedeltaIndex
        # return the i8 result view

        # delta operation
        if not len(self) == len(other):
            raise ValueError("cannot add indices of unequal length")

        self_i8 = self.asi8
        other_i8 = other.asi8
        new_values = checked_add_with_arr(self_i8, other_i8,
                                          arr_mask=self._isnan,
                                          b_mask=other._isnan)
        if self.hasnans or other.hasnans:
            mask = (self._isnan) | (other._isnan)
            new_values[mask] = iNaT
        return new_values.view(self.dtype)

    def isin(self, values):
        """
        Compute boolean array of whether each index value is found in the
        passed set of values

        Parameters
        ----------
        values : set or sequence of values

        Returns
        -------
        is_contained : ndarray (boolean dtype)
        """
        if not isinstance(values, type(self)):
            try:
                values = type(self)(values)
            except ValueError:
                return self.asobject.isin(values)

        return algorithms.isin(self.asi8, values.asi8)

    def shift(self, n, freq=None):
        """
        Specialized shift which produces a DatetimeIndex

        Parameters
        ----------
        n : int
            Periods to shift by
        freq : DateOffset or timedelta-like, optional

        Returns
        -------
        shifted : DatetimeIndex
        """
        if freq is not None and freq != self.freq:
            if isinstance(freq, compat.string_types):
                freq = frequencies.to_offset(freq)
            offset = n * freq
            result = self + offset

            if hasattr(self, 'tz'):
                result.tz = self.tz

            return result

        if n == 0:
            # immutable so OK
            return self

        if self.freq is None:
            raise ValueError("Cannot shift with no freq")

        start = self[0] + n * self.freq
        end = self[-1] + n * self.freq
        attribs = self._get_attributes_dict()
        attribs['start'] = start
        attribs['end'] = end
        return type(self)(**attribs)

    def repeat(self, repeats, *args, **kwargs):
        """
        Analogous to ndarray.repeat
        """
        nv.validate_repeat(args, kwargs)
        if isinstance(self, ABCPeriodIndex):
            freq = self.freq
        else:
            freq = None
        return self._shallow_copy(self.asi8.repeat(repeats),
                                  freq=freq)

    @Appender(_index_shared_docs['where'] % _index_doc_kwargs)
    def where(self, cond, other=None):
        other = _ensure_datetimelike_to_i8(other)
        values = _ensure_datetimelike_to_i8(self)
        result = np.where(cond, values, other).astype('i8')

        result = self._ensure_localized(result)
        return self._shallow_copy(result,
                                  **self._get_attributes_dict())

    def summary(self, name=None):
        """
        return a summarized representation
        """
        formatter = self._formatter_func
        if len(self) > 0:
            index_summary = ', %s to %s' % (formatter(self[0]),
                                            formatter(self[-1]))
        else:
            index_summary = ''

        if name is None:
            name = type(self).__name__
        result = '%s: %s entries%s' % (printing.pprint_thing(name),
                                       len(self), index_summary)
        if self.freq:
            result += '\nFreq: %s' % self.freqstr

        # display as values, not quoted
        result = result.replace("'", "")
        return result

    def _append_same_dtype(self, to_concat, name):
        """
        Concatenate to_concat which has the same class
        """
        attribs = self._get_attributes_dict()
        attribs['name'] = name

        if not isinstance(self, ABCPeriodIndex):
            # reset freq
            attribs['freq'] = None

        if getattr(self, 'tz', None) is not None:
            return _concat._concat_datetimetz(to_concat, name)
        else:
            new_data = np.concatenate([c.asi8 for c in to_concat])
        return self._simple_new(new_data, **attribs)


def _ensure_datetimelike_to_i8(other):
    """ helper for coercing an input scalar or array to i8 """
    if lib.isscalar(other) and isnull(other):
        other = iNaT
    elif isinstance(other, ABCIndexClass):
        # convert tz if needed
        if getattr(other, 'tz', None) is not None:
            other = other.tz_localize(None).asi8
        else:
            other = other.asi8
    else:
        try:
            other = np.array(other, copy=False).view('i8')
        except TypeError:
            # period array cannot be coerces to int
            other = Index(other).asi8
    return other
