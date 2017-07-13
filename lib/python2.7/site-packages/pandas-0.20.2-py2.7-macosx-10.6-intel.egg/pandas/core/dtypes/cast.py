""" routings for casting """

from datetime import datetime, timedelta

import numpy as np
import warnings

from pandas._libs import tslib, lib
from pandas._libs.tslib import iNaT
from pandas.compat import string_types, text_type, PY3
from .common import (_ensure_object, is_bool, is_integer, is_float,
                     is_complex, is_datetimetz, is_categorical_dtype,
                     is_datetimelike,
                     is_extension_type, is_object_dtype,
                     is_datetime64tz_dtype, is_datetime64_dtype,
                     is_timedelta64_dtype, is_dtype_equal,
                     is_float_dtype, is_complex_dtype,
                     is_integer_dtype,
                     is_datetime_or_timedelta_dtype,
                     is_bool_dtype, is_scalar,
                     _string_dtypes,
                     pandas_dtype,
                     _ensure_int8, _ensure_int16,
                     _ensure_int32, _ensure_int64,
                     _NS_DTYPE, _TD_DTYPE, _INT64_DTYPE,
                     _POSSIBLY_CAST_DTYPES)
from .dtypes import ExtensionDtype, DatetimeTZDtype, PeriodDtype
from .generic import (ABCDatetimeIndex, ABCPeriodIndex,
                      ABCSeries)
from .missing import isnull, notnull
from .inference import is_list_like

_int8_max = np.iinfo(np.int8).max
_int16_max = np.iinfo(np.int16).max
_int32_max = np.iinfo(np.int32).max
_int64_max = np.iinfo(np.int64).max


def maybe_convert_platform(values):
    """ try to do platform conversion, allow ndarray or list here """

    if isinstance(values, (list, tuple)):
        values = lib.list_to_object_array(list(values))
    if getattr(values, 'dtype', None) == np.object_:
        if hasattr(values, '_values'):
            values = values._values
        values = lib.maybe_convert_objects(values)

    return values


def is_nested_object(obj):
    """
    return a boolean if we have a nested object, e.g. a Series with 1 or
    more Series elements

    This may not be necessarily be performant.

    """

    if isinstance(obj, ABCSeries) and is_object_dtype(obj):

        if any(isinstance(v, ABCSeries) for v in obj.values):
            return True

    return False


def maybe_downcast_to_dtype(result, dtype):
    """ try to cast to the specified dtype (e.g. convert back to bool/int
    or could be an astype of float64->float32
    """

    if is_scalar(result):
        return result

    def trans(x):
        return x

    if isinstance(dtype, string_types):
        if dtype == 'infer':
            inferred_type = lib.infer_dtype(_ensure_object(result.ravel()))
            if inferred_type == 'boolean':
                dtype = 'bool'
            elif inferred_type == 'integer':
                dtype = 'int64'
            elif inferred_type == 'datetime64':
                dtype = 'datetime64[ns]'
            elif inferred_type == 'timedelta64':
                dtype = 'timedelta64[ns]'

            # try to upcast here
            elif inferred_type == 'floating':
                dtype = 'int64'
                if issubclass(result.dtype.type, np.number):

                    def trans(x):  # noqa
                        return x.round()
            else:
                dtype = 'object'

    if isinstance(dtype, string_types):
        dtype = np.dtype(dtype)

    try:

        # don't allow upcasts here (except if empty)
        if dtype.kind == result.dtype.kind:
            if (result.dtype.itemsize <= dtype.itemsize and
                    np.prod(result.shape)):
                return result

        if issubclass(dtype.type, np.floating):
            return result.astype(dtype)
        elif is_bool_dtype(dtype) or is_integer_dtype(dtype):

            # if we don't have any elements, just astype it
            if not np.prod(result.shape):
                return trans(result).astype(dtype)

            # do a test on the first element, if it fails then we are done
            r = result.ravel()
            arr = np.array([r[0]])

            # if we have any nulls, then we are done
            if (isnull(arr).any() or
                    not np.allclose(arr, trans(arr).astype(dtype), rtol=0)):
                return result

            # a comparable, e.g. a Decimal may slip in here
            elif not isinstance(r[0], (np.integer, np.floating, np.bool, int,
                                       float, bool)):
                return result

            if (issubclass(result.dtype.type, (np.object_, np.number)) and
                    notnull(result).all()):
                new_result = trans(result).astype(dtype)
                try:
                    if np.allclose(new_result, result, rtol=0):
                        return new_result
                except:

                    # comparison of an object dtype with a number type could
                    # hit here
                    if (new_result == result).all():
                        return new_result

        # a datetimelike
        # GH12821, iNaT is casted to float
        elif dtype.kind in ['M', 'm'] and result.dtype.kind in ['i', 'f']:
            try:
                result = result.astype(dtype)
            except:
                if dtype.tz:
                    # convert to datetime and change timezone
                    from pandas import to_datetime
                    result = to_datetime(result).tz_localize('utc')
                    result = result.tz_convert(dtype.tz)

    except:
        pass

    return result


def maybe_upcast_putmask(result, mask, other):
    """
    A safe version of putmask that potentially upcasts the result

    Parameters
    ----------
    result : ndarray
        The destination array. This will be mutated in-place if no upcasting is
        necessary.
    mask : boolean ndarray
    other : ndarray or scalar
        The source array or value

    Returns
    -------
    result : ndarray
    changed : boolean
        Set to true if the result array was upcasted
    """

    if mask.any():
        # Two conversions for date-like dtypes that can't be done automatically
        # in np.place:
        #   NaN -> NaT
        #   integer or integer array -> date-like array
        if is_datetimelike(result.dtype):
            if is_scalar(other):
                if isnull(other):
                    other = result.dtype.type('nat')
                elif is_integer(other):
                    other = np.array(other, dtype=result.dtype)
            elif is_integer_dtype(other):
                other = np.array(other, dtype=result.dtype)

        def changeit():

            # try to directly set by expanding our array to full
            # length of the boolean
            try:
                om = other[mask]
                om_at = om.astype(result.dtype)
                if (om == om_at).all():
                    new_result = result.values.copy()
                    new_result[mask] = om_at
                    result[:] = new_result
                    return result, False
            except:
                pass

            # we are forced to change the dtype of the result as the input
            # isn't compatible
            r, _ = maybe_upcast(result, fill_value=other, copy=True)
            np.place(r, mask, other)

            return r, True

        # we want to decide whether place will work
        # if we have nans in the False portion of our mask then we need to
        # upcast (possibly), otherwise we DON't want to upcast (e.g. if we
        # have values, say integers, in the success portion then it's ok to not
        # upcast)
        new_dtype, _ = maybe_promote(result.dtype, other)
        if new_dtype != result.dtype:

            # we have a scalar or len 0 ndarray
            # and its nan and we are changing some values
            if (is_scalar(other) or
                    (isinstance(other, np.ndarray) and other.ndim < 1)):
                if isnull(other):
                    return changeit()

            # we have an ndarray and the masking has nans in it
            else:

                if isnull(other[mask]).any():
                    return changeit()

        try:
            np.place(result, mask, other)
        except:
            return changeit()

    return result, False


def maybe_promote(dtype, fill_value=np.nan):

    # if we passed an array here, determine the fill value by dtype
    if isinstance(fill_value, np.ndarray):
        if issubclass(fill_value.dtype.type, (np.datetime64, np.timedelta64)):
            fill_value = iNaT
        else:

            # we need to change to object type as our
            # fill_value is of object type
            if fill_value.dtype == np.object_:
                dtype = np.dtype(np.object_)
            fill_value = np.nan

    # returns tuple of (dtype, fill_value)
    if issubclass(dtype.type, (np.datetime64, np.timedelta64)):
        # for now: refuse to upcast datetime64
        # (this is because datetime64 will not implicitly upconvert
        #  to object correctly as of numpy 1.6.1)
        if isnull(fill_value):
            fill_value = iNaT
        else:
            if issubclass(dtype.type, np.datetime64):
                try:
                    fill_value = lib.Timestamp(fill_value).value
                except:
                    # the proper thing to do here would probably be to upcast
                    # to object (but numpy 1.6.1 doesn't do this properly)
                    fill_value = iNaT
            elif issubclass(dtype.type, np.timedelta64):
                try:
                    fill_value = lib.Timedelta(fill_value).value
                except:
                    # as for datetimes, cannot upcast to object
                    fill_value = iNaT
            else:
                fill_value = iNaT
    elif is_datetimetz(dtype):
        if isnull(fill_value):
            fill_value = iNaT
    elif is_float(fill_value):
        if issubclass(dtype.type, np.bool_):
            dtype = np.object_
        elif issubclass(dtype.type, np.integer):
            dtype = np.float64
    elif is_bool(fill_value):
        if not issubclass(dtype.type, np.bool_):
            dtype = np.object_
    elif is_integer(fill_value):
        if issubclass(dtype.type, np.bool_):
            dtype = np.object_
        elif issubclass(dtype.type, np.integer):
            # upcast to prevent overflow
            arr = np.asarray(fill_value)
            if arr != arr.astype(dtype):
                dtype = arr.dtype
    elif is_complex(fill_value):
        if issubclass(dtype.type, np.bool_):
            dtype = np.object_
        elif issubclass(dtype.type, (np.integer, np.floating)):
            dtype = np.complex128
    elif fill_value is None:
        if is_float_dtype(dtype) or is_complex_dtype(dtype):
            fill_value = np.nan
        elif is_integer_dtype(dtype):
            dtype = np.float64
            fill_value = np.nan
        elif is_datetime_or_timedelta_dtype(dtype):
            fill_value = iNaT
        else:
            dtype = np.object_
    else:
        dtype = np.object_

    # in case we have a string that looked like a number
    if is_categorical_dtype(dtype):
        pass
    elif is_datetimetz(dtype):
        pass
    elif issubclass(np.dtype(dtype).type, string_types):
        dtype = np.object_

    return dtype, fill_value


def infer_dtype_from_scalar(val, pandas_dtype=False):
    """
    interpret the dtype from a scalar

    Parameters
    ----------
    pandas_dtype : bool, default False
        whether to infer dtype including pandas extension types.
        If False, scalar belongs to pandas extension types is inferred as
        object
    """

    dtype = np.object_

    # a 1-element ndarray
    if isinstance(val, np.ndarray):
        if val.ndim != 0:
            raise ValueError(
                "invalid ndarray passed to _infer_dtype_from_scalar")

        dtype = val.dtype
        val = val.item()

    elif isinstance(val, string_types):

        # If we create an empty array using a string to infer
        # the dtype, NumPy will only allocate one character per entry
        # so this is kind of bad. Alternately we could use np.repeat
        # instead of np.empty (but then you still don't want things
        # coming out as np.str_!

        dtype = np.object_

    elif isinstance(val, (np.datetime64, datetime)):
        val = tslib.Timestamp(val)
        if val is tslib.NaT or val.tz is None:
            dtype = np.dtype('M8[ns]')
        else:
            if pandas_dtype:
                dtype = DatetimeTZDtype(unit='ns', tz=val.tz)
            else:
                # return datetimetz as object
                return np.object_, val
        val = val.value

    elif isinstance(val, (np.timedelta64, timedelta)):
        val = tslib.Timedelta(val).value
        dtype = np.dtype('m8[ns]')

    elif is_bool(val):
        dtype = np.bool_

    elif is_integer(val):
        if isinstance(val, np.integer):
            dtype = type(val)
        else:
            dtype = np.int64

    elif is_float(val):
        if isinstance(val, np.floating):
            dtype = type(val)
        else:
            dtype = np.float64

    elif is_complex(val):
        dtype = np.complex_

    elif pandas_dtype:
        if lib.is_period(val):
            dtype = PeriodDtype(freq=val.freq)
            val = val.ordinal

    return dtype, val


def infer_dtype_from_array(arr):
    """
    infer the dtype from a scalar or array

    Parameters
    ----------
    arr : scalar or array

    Returns
    -------
    tuple (numpy-compat dtype, array)

    Notes
    -----
    These infer to numpy dtypes exactly
    with the exception that mixed / object dtypes
    are not coerced by stringifying or conversion

    Examples
    --------
    >>> np.asarray([1, '1'])
    array(['1', '1'], dtype='<U21')

    >>> infer_dtype_from_array([1, '1'])
    (numpy.object_, [1, '1'])

    """

    if isinstance(arr, np.ndarray):
        return arr.dtype, arr

    if not is_list_like(arr):
        arr = [arr]

    # don't force numpy coerce with nan's
    inferred = lib.infer_dtype(arr)
    if inferred in ['string', 'bytes', 'unicode',
                    'mixed', 'mixed-integer']:
        return (np.object_, arr)

    arr = np.asarray(arr)
    return arr.dtype, arr


def maybe_upcast(values, fill_value=np.nan, dtype=None, copy=False):
    """ provide explict type promotion and coercion

    Parameters
    ----------
    values : the ndarray that we want to maybe upcast
    fill_value : what we want to fill with
    dtype : if None, then use the dtype of the values, else coerce to this type
    copy : if True always make a copy even if no upcast is required
    """

    if is_extension_type(values):
        if copy:
            values = values.copy()
    else:
        if dtype is None:
            dtype = values.dtype
        new_dtype, fill_value = maybe_promote(dtype, fill_value)
        if new_dtype != values.dtype:
            values = values.astype(new_dtype)
        elif copy:
            values = values.copy()

    return values, fill_value


def maybe_cast_item(obj, item, dtype):
    chunk = obj[item]

    if chunk.values.dtype != dtype:
        if dtype in (np.object_, np.bool_):
            obj[item] = chunk.astype(np.object_)
        elif not issubclass(dtype, (np.integer, np.bool_)):  # pragma: no cover
            raise ValueError("Unexpected dtype encountered: %s" % dtype)


def invalidate_string_dtypes(dtype_set):
    """Change string like dtypes to object for
    ``DataFrame.select_dtypes()``.
    """
    non_string_dtypes = dtype_set - _string_dtypes
    if non_string_dtypes != dtype_set:
        raise TypeError("string dtypes are not allowed, use 'object' instead")


def maybe_convert_string_to_object(values):
    """

    Convert string-like and string-like array to convert object dtype.
    This is to avoid numpy to handle the array as str dtype.
    """
    if isinstance(values, string_types):
        values = np.array([values], dtype=object)
    elif (isinstance(values, np.ndarray) and
          issubclass(values.dtype.type, (np.string_, np.unicode_))):
        values = values.astype(object)
    return values


def maybe_convert_scalar(values):
    """
    Convert a python scalar to the appropriate numpy dtype if possible
    This avoids numpy directly converting according to platform preferences
    """
    if is_scalar(values):
        dtype, values = infer_dtype_from_scalar(values)
        try:
            values = dtype(values)
        except TypeError:
            pass
    return values


def coerce_indexer_dtype(indexer, categories):
    """ coerce the indexer input array to the smallest dtype possible """
    l = len(categories)
    if l < _int8_max:
        return _ensure_int8(indexer)
    elif l < _int16_max:
        return _ensure_int16(indexer)
    elif l < _int32_max:
        return _ensure_int32(indexer)
    return _ensure_int64(indexer)


def coerce_to_dtypes(result, dtypes):
    """
    given a dtypes and a result set, coerce the result elements to the
    dtypes
    """
    if len(result) != len(dtypes):
        raise AssertionError("_coerce_to_dtypes requires equal len arrays")

    from pandas.core.tools.timedeltas import _coerce_scalar_to_timedelta_type

    def conv(r, dtype):
        try:
            if isnull(r):
                pass
            elif dtype == _NS_DTYPE:
                r = lib.Timestamp(r)
            elif dtype == _TD_DTYPE:
                r = _coerce_scalar_to_timedelta_type(r)
            elif dtype == np.bool_:
                # messy. non 0/1 integers do not get converted.
                if is_integer(r) and r not in [0, 1]:
                    return int(r)
                r = bool(r)
            elif dtype.kind == 'f':
                r = float(r)
            elif dtype.kind == 'i':
                r = int(r)
        except:
            pass

        return r

    return [conv(r, dtype) for r, dtype in zip(result, dtypes)]


def astype_nansafe(arr, dtype, copy=True):
    """ return a view if copy is False, but
        need to be very careful as the result shape could change! """
    if not isinstance(dtype, np.dtype):
        dtype = pandas_dtype(dtype)

    if issubclass(dtype.type, text_type):
        # in Py3 that's str, in Py2 that's unicode
        return lib.astype_unicode(arr.ravel()).reshape(arr.shape)
    elif issubclass(dtype.type, string_types):
        return lib.astype_str(arr.ravel()).reshape(arr.shape)
    elif is_datetime64_dtype(arr):
        if dtype == object:
            return tslib.ints_to_pydatetime(arr.view(np.int64))
        elif dtype == np.int64:
            return arr.view(dtype)
        elif dtype != _NS_DTYPE:
            raise TypeError("cannot astype a datetimelike from [%s] to [%s]" %
                            (arr.dtype, dtype))
        return arr.astype(_NS_DTYPE)
    elif is_timedelta64_dtype(arr):
        if dtype == np.int64:
            return arr.view(dtype)
        elif dtype == object:
            return tslib.ints_to_pytimedelta(arr.view(np.int64))

        # in py3, timedelta64[ns] are int64
        elif ((PY3 and dtype not in [_INT64_DTYPE, _TD_DTYPE]) or
              (not PY3 and dtype != _TD_DTYPE)):

            # allow frequency conversions
            if dtype.kind == 'm':
                mask = isnull(arr)
                result = arr.astype(dtype).astype(np.float64)
                result[mask] = np.nan
                return result

            raise TypeError("cannot astype a timedelta from [%s] to [%s]" %
                            (arr.dtype, dtype))

        return arr.astype(_TD_DTYPE)
    elif (np.issubdtype(arr.dtype, np.floating) and
          np.issubdtype(dtype, np.integer)):

        if not np.isfinite(arr).all():
            raise ValueError('Cannot convert non-finite values (NA or inf) to '
                             'integer')

    elif arr.dtype == np.object_ and np.issubdtype(dtype.type, np.integer):
        # work around NumPy brokenness, #1987
        return lib.astype_intsafe(arr.ravel(), dtype).reshape(arr.shape)

    if dtype.name in ("datetime64", "timedelta64"):
        msg = ("Passing in '{dtype}' dtype with no frequency is "
               "deprecated and will raise in a future version. "
               "Please pass in '{dtype}[ns]' instead.")
        warnings.warn(msg.format(dtype=dtype.name),
                      FutureWarning, stacklevel=5)
        dtype = np.dtype(dtype.name + "[ns]")

    if copy:
        return arr.astype(dtype)
    return arr.view(dtype)


def maybe_convert_objects(values, convert_dates=True, convert_numeric=True,
                          convert_timedeltas=True, copy=True):
    """ if we have an object dtype, try to coerce dates and/or numbers """

    # if we have passed in a list or scalar
    if isinstance(values, (list, tuple)):
        values = np.array(values, dtype=np.object_)
    if not hasattr(values, 'dtype'):
        values = np.array([values], dtype=np.object_)

    # convert dates
    if convert_dates and values.dtype == np.object_:

        # we take an aggressive stance and convert to datetime64[ns]
        if convert_dates == 'coerce':
            new_values = maybe_cast_to_datetime(
                values, 'M8[ns]', errors='coerce')

            # if we are all nans then leave me alone
            if not isnull(new_values).all():
                values = new_values

        else:
            values = lib.maybe_convert_objects(values,
                                               convert_datetime=convert_dates)

    # convert timedeltas
    if convert_timedeltas and values.dtype == np.object_:

        if convert_timedeltas == 'coerce':
            from pandas.core.tools.timedeltas import to_timedelta
            new_values = to_timedelta(values, coerce=True)

            # if we are all nans then leave me alone
            if not isnull(new_values).all():
                values = new_values

        else:
            values = lib.maybe_convert_objects(
                values, convert_timedelta=convert_timedeltas)

    # convert to numeric
    if values.dtype == np.object_:
        if convert_numeric:
            try:
                new_values = lib.maybe_convert_numeric(values, set(),
                                                       coerce_numeric=True)

                # if we are all nans then leave me alone
                if not isnull(new_values).all():
                    values = new_values

            except:
                pass
        else:
            # soft-conversion
            values = lib.maybe_convert_objects(values)

    values = values.copy() if copy else values

    return values


def soft_convert_objects(values, datetime=True, numeric=True, timedelta=True,
                         coerce=False, copy=True):
    """ if we have an object dtype, try to coerce dates and/or numbers """

    conversion_count = sum((datetime, numeric, timedelta))
    if conversion_count == 0:
        raise ValueError('At least one of datetime, numeric or timedelta must '
                         'be True.')
    elif conversion_count > 1 and coerce:
        raise ValueError("Only one of 'datetime', 'numeric' or "
                         "'timedelta' can be True when when coerce=True.")

    if isinstance(values, (list, tuple)):
        # List or scalar
        values = np.array(values, dtype=np.object_)
    elif not hasattr(values, 'dtype'):
        values = np.array([values], dtype=np.object_)
    elif not is_object_dtype(values.dtype):
        # If not object, do not attempt conversion
        values = values.copy() if copy else values
        return values

    # If 1 flag is coerce, ensure 2 others are False
    if coerce:
        # Immediate return if coerce
        if datetime:
            from pandas import to_datetime
            return to_datetime(values, errors='coerce', box=False)
        elif timedelta:
            from pandas import to_timedelta
            return to_timedelta(values, errors='coerce', box=False)
        elif numeric:
            from pandas import to_numeric
            return to_numeric(values, errors='coerce')

    # Soft conversions
    if datetime:
        values = lib.maybe_convert_objects(values, convert_datetime=datetime)

    if timedelta and is_object_dtype(values.dtype):
        # Object check to ensure only run if previous did not convert
        values = lib.maybe_convert_objects(values, convert_timedelta=timedelta)

    if numeric and is_object_dtype(values.dtype):
        try:
            converted = lib.maybe_convert_numeric(values, set(),
                                                  coerce_numeric=True)
            # If all NaNs, then do not-alter
            values = converted if not isnull(converted).all() else values
            values = values.copy() if copy else values
        except:
            pass

    return values


def maybe_castable(arr):
    # return False to force a non-fastpath

    # check datetime64[ns]/timedelta64[ns] are valid
    # otherwise try to coerce
    kind = arr.dtype.kind
    if kind == 'M' or kind == 'm':
        return is_datetime64_dtype(arr.dtype)

    return arr.dtype.name not in _POSSIBLY_CAST_DTYPES


def maybe_infer_to_datetimelike(value, convert_dates=False):
    """
    we might have a array (or single object) that is datetime like,
    and no dtype is passed don't change the value unless we find a
    datetime/timedelta set

    this is pretty strict in that a datetime/timedelta is REQUIRED
    in addition to possible nulls/string likes

    Parameters
    ----------
    value : np.array / Series / Index / list-like
    convert_dates : boolean, default False
       if True try really hard to convert dates (such as datetime.date), other
       leave inferred dtype 'date' alone

    """

    if isinstance(value, (ABCDatetimeIndex, ABCPeriodIndex)):
        return value
    elif isinstance(value, ABCSeries):
        if isinstance(value._values, ABCDatetimeIndex):
            return value._values

    v = value

    if not is_list_like(v):
        v = [v]
    v = np.array(v, copy=False)

    # we only care about object dtypes
    if not is_object_dtype(v):
        return value

    shape = v.shape
    if not v.ndim == 1:
        v = v.ravel()

    if not len(v):
        return value

    def try_datetime(v):
        # safe coerce to datetime64
        try:
            v = tslib.array_to_datetime(v, errors='raise')
        except ValueError:

            # we might have a sequence of the same-datetimes with tz's
            # if so coerce to a DatetimeIndex; if they are not the same,
            # then these stay as object dtype
            try:
                from pandas import to_datetime
                return to_datetime(v)
            except:
                pass

        except:
            pass

        return v.reshape(shape)

    def try_timedelta(v):
        # safe coerce to timedelta64

        # will try first with a string & object conversion
        from pandas import to_timedelta
        try:
            return to_timedelta(v)._values.reshape(shape)
        except:
            return v.reshape(shape)

    inferred_type = lib.infer_datetimelike_array(_ensure_object(v))

    if inferred_type == 'date' and convert_dates:
        value = try_datetime(v)
    elif inferred_type == 'datetime':
        value = try_datetime(v)
    elif inferred_type == 'timedelta':
        value = try_timedelta(v)
    elif inferred_type == 'nat':

        # if all NaT, return as datetime
        if isnull(v).all():
            value = try_datetime(v)
        else:

            # We have at least a NaT and a string
            # try timedelta first to avoid spurious datetime conversions
            # e.g. '00:00:01' is a timedelta but
            # technically is also a datetime
            value = try_timedelta(v)
            if lib.infer_dtype(value) in ['mixed']:
                value = try_datetime(v)

    return value


def maybe_cast_to_datetime(value, dtype, errors='raise'):
    """ try to cast the array/value to a datetimelike dtype, converting float
    nan to iNaT
    """
    from pandas.core.tools.timedeltas import to_timedelta
    from pandas.core.tools.datetimes import to_datetime

    if dtype is not None:
        if isinstance(dtype, string_types):
            dtype = np.dtype(dtype)

        is_datetime64 = is_datetime64_dtype(dtype)
        is_datetime64tz = is_datetime64tz_dtype(dtype)
        is_timedelta64 = is_timedelta64_dtype(dtype)

        if is_datetime64 or is_datetime64tz or is_timedelta64:

            # force the dtype if needed
            msg = ("Passing in '{dtype}' dtype with no frequency is "
                   "deprecated and will raise in a future version. "
                   "Please pass in '{dtype}[ns]' instead.")

            if is_datetime64 and not is_dtype_equal(dtype, _NS_DTYPE):
                if dtype.name in ('datetime64', 'datetime64[ns]'):
                    if dtype.name == 'datetime64':
                        warnings.warn(msg.format(dtype=dtype.name),
                                      FutureWarning, stacklevel=5)
                    dtype = _NS_DTYPE
                else:
                    raise TypeError("cannot convert datetimelike to "
                                    "dtype [%s]" % dtype)
            elif is_datetime64tz:

                # our NaT doesn't support tz's
                # this will coerce to DatetimeIndex with
                # a matching dtype below
                if is_scalar(value) and isnull(value):
                    value = [value]

            elif is_timedelta64 and not is_dtype_equal(dtype, _TD_DTYPE):
                if dtype.name in ('timedelta64', 'timedelta64[ns]'):
                    if dtype.name == 'timedelta64':
                        warnings.warn(msg.format(dtype=dtype.name),
                                      FutureWarning, stacklevel=5)
                    dtype = _TD_DTYPE
                else:
                    raise TypeError("cannot convert timedeltalike to "
                                    "dtype [%s]" % dtype)

            if is_scalar(value):
                if value == iNaT or isnull(value):
                    value = iNaT
            else:
                value = np.array(value, copy=False)

                # have a scalar array-like (e.g. NaT)
                if value.ndim == 0:
                    value = iNaT

                # we have an array of datetime or timedeltas & nulls
                elif np.prod(value.shape) or not is_dtype_equal(value.dtype,
                                                                dtype):
                    try:
                        if is_datetime64:
                            value = to_datetime(value, errors=errors)._values
                        elif is_datetime64tz:
                            # input has to be UTC at this point, so just
                            # localize
                            value = (to_datetime(value, errors=errors)
                                     .tz_localize('UTC')
                                     .tz_convert(dtype.tz)
                                     )
                        elif is_timedelta64:
                            value = to_timedelta(value, errors=errors)._values
                    except (AttributeError, ValueError, TypeError):
                        pass

        # coerce datetimelike to object
        elif is_datetime64_dtype(value) and not is_datetime64_dtype(dtype):
            if is_object_dtype(dtype):
                if value.dtype != _NS_DTYPE:
                    value = value.astype(_NS_DTYPE)
                ints = np.asarray(value).view('i8')
                return tslib.ints_to_pydatetime(ints)

            # we have a non-castable dtype that was passed
            raise TypeError('Cannot cast datetime64 to %s' % dtype)

    else:

        is_array = isinstance(value, np.ndarray)

        # catch a datetime/timedelta that is not of ns variety
        # and no coercion specified
        if is_array and value.dtype.kind in ['M', 'm']:
            dtype = value.dtype

            if dtype.kind == 'M' and dtype != _NS_DTYPE:
                value = value.astype(_NS_DTYPE)

            elif dtype.kind == 'm' and dtype != _TD_DTYPE:
                value = to_timedelta(value)

        # only do this if we have an array and the dtype of the array is not
        # setup already we are not an integer/object, so don't bother with this
        # conversion
        elif not (is_array and not (issubclass(value.dtype.type, np.integer) or
                                    value.dtype == np.object_)):
            value = maybe_infer_to_datetimelike(value)

    return value


def find_common_type(types):
    """
    Find a common data type among the given dtypes.

    Parameters
    ----------
    types : list of dtypes

    Returns
    -------
    pandas extension or numpy dtype

    See Also
    --------
    numpy.find_common_type

    """

    if len(types) == 0:
        raise ValueError('no types given')

    first = types[0]

    # workaround for find_common_type([np.dtype('datetime64[ns]')] * 2)
    # => object
    if all(is_dtype_equal(first, t) for t in types[1:]):
        return first

    if any(isinstance(t, ExtensionDtype) for t in types):
        return np.object

    # take lowest unit
    if all(is_datetime64_dtype(t) for t in types):
        return np.dtype('datetime64[ns]')
    if all(is_timedelta64_dtype(t) for t in types):
        return np.dtype('timedelta64[ns]')

    # don't mix bool / int or float or complex
    # this is different from numpy, which casts bool with float/int as int
    has_bools = any(is_bool_dtype(t) for t in types)
    if has_bools:
        has_ints = any(is_integer_dtype(t) for t in types)
        has_floats = any(is_float_dtype(t) for t in types)
        has_complex = any(is_complex_dtype(t) for t in types)
        if has_ints or has_floats or has_complex:
            return np.object

    return np.find_common_type(types, [])
