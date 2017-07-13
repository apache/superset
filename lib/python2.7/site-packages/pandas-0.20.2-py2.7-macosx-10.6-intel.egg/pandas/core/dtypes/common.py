""" common type operations """

import numpy as np
from pandas.compat import (string_types, text_type, binary_type,
                           PY3, PY36)
from pandas._libs import algos, lib
from .dtypes import (CategoricalDtype, CategoricalDtypeType,
                     DatetimeTZDtype, DatetimeTZDtypeType,
                     PeriodDtype, PeriodDtypeType,
                     IntervalDtype, IntervalDtypeType,
                     ExtensionDtype)
from .generic import (ABCCategorical, ABCPeriodIndex,
                      ABCDatetimeIndex, ABCSeries,
                      ABCSparseArray, ABCSparseSeries)
from .inference import is_string_like
from .inference import *  # noqa


_POSSIBLY_CAST_DTYPES = set([np.dtype(t).name
                             for t in ['O', 'int8', 'uint8', 'int16', 'uint16',
                                       'int32', 'uint32', 'int64', 'uint64']])

_NS_DTYPE = np.dtype('M8[ns]')
_TD_DTYPE = np.dtype('m8[ns]')
_INT64_DTYPE = np.dtype(np.int64)

# oh the troubles to reduce import time
_is_scipy_sparse = None

_ensure_float64 = algos.ensure_float64
_ensure_float32 = algos.ensure_float32


def _ensure_float(arr):
    """
    Ensure that an array object has a float dtype if possible.

    Parameters
    ----------
    arr : array-like
        The array whose data type we want to enforce as float.

    Returns
    -------
    float_arr : The original array cast to the float dtype if
                possible. Otherwise, the original array is returned.
    """

    if issubclass(arr.dtype.type, (np.integer, np.bool_)):
        arr = arr.astype(float)
    return arr


_ensure_uint64 = algos.ensure_uint64
_ensure_int64 = algos.ensure_int64
_ensure_int32 = algos.ensure_int32
_ensure_int16 = algos.ensure_int16
_ensure_int8 = algos.ensure_int8
_ensure_platform_int = algos.ensure_platform_int
_ensure_object = algos.ensure_object


def _ensure_categorical(arr):
    """
    Ensure that an array-like object is a Categorical (if not already).

    Parameters
    ----------
    arr : array-like
        The array that we want to convert into a Categorical.

    Returns
    -------
    cat_arr : The original array cast as a Categorical. If it already
              is a Categorical, we return as is.
    """

    if not is_categorical(arr):
        from pandas import Categorical
        arr = Categorical(arr)
    return arr


def is_object_dtype(arr_or_dtype):
    """
    Check whether an array-like or dtype is of the object dtype.

    Parameters
    ----------
    arr_or_dtype : array-like
        The array-like or dtype to check.

    Returns
    -------
    boolean : Whether or not the array-like or dtype is of the object dtype.

    Examples
    --------
    >>> is_object_dtype(object)
    True
    >>> is_object_dtype(int)
    False
    >>> is_object_dtype(np.array([], dtype=object))
    True
    >>> is_object_dtype(np.array([], dtype=int))
    False
    >>> is_object_dtype([1, 2, 3])
    False
    """

    if arr_or_dtype is None:
        return False
    tipo = _get_dtype_type(arr_or_dtype)
    return issubclass(tipo, np.object_)


def is_sparse(arr):
    """
    Check whether an array-like is a pandas sparse array.

    Parameters
    ----------
    arr : array-like
        The array-like to check.

    Returns
    -------
    boolean : Whether or not the array-like is a pandas sparse array.

    Examples
    --------
    >>> is_sparse(np.array([1, 2, 3]))
    False
    >>> is_sparse(pd.SparseArray([1, 2, 3]))
    True
    >>> is_sparse(pd.SparseSeries([1, 2, 3]))
    True

    This function checks only for pandas sparse array instances, so
    sparse arrays from other libraries will return False.

    >>> from scipy.sparse import bsr_matrix
    >>> is_sparse(bsr_matrix([1, 2, 3]))
    False
    """

    return isinstance(arr, (ABCSparseArray, ABCSparseSeries))


def is_scipy_sparse(arr):
    """
    Check whether an array-like is a scipy.sparse.spmatrix instance.

    Parameters
    ----------
    arr : array-like
        The array-like to check.

    Returns
    -------
    boolean : Whether or not the array-like is a
              scipy.sparse.spmatrix instance.

    Notes
    -----
    If scipy is not installed, this function will always return False.

    Examples
    --------
    >>> from scipy.sparse import bsr_matrix
    >>> is_scipy_sparse(bsr_matrix([1, 2, 3]))
    True
    >>> is_scipy_sparse(pd.SparseArray([1, 2, 3]))
    False
    >>> is_scipy_sparse(pd.SparseSeries([1, 2, 3]))
    False
    """

    global _is_scipy_sparse

    if _is_scipy_sparse is None:
        try:
            from scipy.sparse import issparse as _is_scipy_sparse
        except ImportError:
            _is_scipy_sparse = lambda _: False

    return _is_scipy_sparse(arr)


def is_categorical(arr):
    """
    Check whether an array-like is a Categorical instance.

    Parameters
    ----------
    arr : array-like
        The array-like to check.

    Returns
    -------
    boolean : Whether or not the array-like is of a Categorical instance.

    Examples
    --------
    >>> is_categorical([1, 2, 3])
    False

    Categoricals, Series Categoricals, and CategoricalIndex will return True.

    >>> cat = pd.Categorical([1, 2, 3])
    >>> is_categorical(cat)
    True
    >>> is_categorical(pd.Series(cat))
    True
    >>> is_categorical(pd.CategoricalIndex([1, 2, 3]))
    True
    """

    return isinstance(arr, ABCCategorical) or is_categorical_dtype(arr)


def is_datetimetz(arr):
    """
    Check whether an array-like is a datetime array-like with a timezone
    component in its dtype.

    Parameters
    ----------
    arr : array-like
        The array-like to check.

    Returns
    -------
    boolean : Whether or not the array-like is a datetime array-like with
              a timezone component in its dtype.

    Examples
    --------
    >>> is_datetimetz([1, 2, 3])
    False

    Although the following examples are both DatetimeIndex objects,
    the first one returns False because it has no timezone component
    unlike the second one, which returns True.

    >>> is_datetimetz(pd.DatetimeIndex([1, 2, 3]))
    False
    >>> is_datetimetz(pd.DatetimeIndex([1, 2, 3], tz="US/Eastern"))
    True

    The object need not be a DatetimeIndex object. It just needs to have
    a dtype which has a timezone component.

    >>> dtype = DatetimeTZDtype("ns", tz="US/Eastern")
    >>> s = pd.Series([], dtype=dtype)
    >>> is_datetimetz(s)
    True
    """

    # TODO: do we need this function?
    # It seems like a repeat of is_datetime64tz_dtype.

    return ((isinstance(arr, ABCDatetimeIndex) and
             getattr(arr, 'tz', None) is not None) or
            is_datetime64tz_dtype(arr))


def is_period(arr):
    """
    Check whether an array-like is a periodical index.

    Parameters
    ----------
    arr : array-like
        The array-like to check.

    Returns
    -------
    boolean : Whether or not the array-like is a periodical index.

    Examples
    --------
    >>> is_period([1, 2, 3])
    False
    >>> is_period(pd.Index([1, 2, 3]))
    False
    >>> is_period(pd.PeriodIndex(["2017-01-01"], freq="D"))
    True
    """

    # TODO: do we need this function?
    # It seems like a repeat of is_period_arraylike.
    return isinstance(arr, ABCPeriodIndex) or is_period_arraylike(arr)


def is_datetime64_dtype(arr_or_dtype):
    """
    Check whether an array-like or dtype is of the datetime64 dtype.

    Parameters
    ----------
    arr_or_dtype : array-like
        The array-like or dtype to check.

    Returns
    -------
    boolean : Whether or not the array-like or dtype is of
              the datetime64 dtype.

    Examples
    --------
    >>> is_datetime64_dtype(object)
    False
    >>> is_datetime64_dtype(np.datetime64)
    True
    >>> is_datetime64_dtype(np.array([], dtype=int))
    False
    >>> is_datetime64_dtype(np.array([], dtype=np.datetime64))
    True
    >>> is_datetime64_dtype([1, 2, 3])
    False
    """

    if arr_or_dtype is None:
        return False
    try:
        tipo = _get_dtype_type(arr_or_dtype)
    except TypeError:
        return False
    return issubclass(tipo, np.datetime64)


def is_datetime64tz_dtype(arr_or_dtype):
    """
    Check whether an array-like or dtype is of a DatetimeTZDtype dtype.

    Parameters
    ----------
    arr_or_dtype : array-like
        The array-like or dtype to check.

    Returns
    -------
    boolean : Whether or not the array-like or dtype is of
              a DatetimeTZDtype dtype.

    Examples
    --------
    >>> is_datetime64tz_dtype(object)
    False
    >>> is_datetime64tz_dtype([1, 2, 3])
    False
    >>> is_datetime64tz_dtype(pd.DatetimeIndex([1, 2, 3]))  # tz-naive
    False
    >>> is_datetime64tz_dtype(pd.DatetimeIndex([1, 2, 3], tz="US/Eastern"))
    True

    >>> dtype = DatetimeTZDtype("ns", tz="US/Eastern")
    >>> s = pd.Series([], dtype=dtype)
    >>> is_datetime64tz_dtype(dtype)
    True
    >>> is_datetime64tz_dtype(s)
    True
    """

    if arr_or_dtype is None:
        return False
    return DatetimeTZDtype.is_dtype(arr_or_dtype)


def is_timedelta64_dtype(arr_or_dtype):
    """
    Check whether an array-like or dtype is of the timedelta64 dtype.

    Parameters
    ----------
    arr_or_dtype : array-like
        The array-like or dtype to check.

    Returns
    -------
    boolean : Whether or not the array-like or dtype is
              of the timedelta64 dtype.

    Examples
    --------
    >>> is_timedelta64_dtype(object)
    False
    >>> is_timedelta64_dtype(np.timedelta64)
    True
    >>> is_timedelta64_dtype([1, 2, 3])
    False
    >>> is_timedelta64_dtype(pd.Series([], dtype="timedelta64[ns]"))
    True
    """

    if arr_or_dtype is None:
        return False
    tipo = _get_dtype_type(arr_or_dtype)
    return issubclass(tipo, np.timedelta64)


def is_period_dtype(arr_or_dtype):
    """
    Check whether an array-like or dtype is of the Period dtype.

    Parameters
    ----------
    arr_or_dtype : array-like
        The array-like or dtype to check.

    Returns
    -------
    boolean : Whether or not the array-like or dtype is of the Period dtype.

    Examples
    --------
    >>> is_period_dtype(object)
    False
    >>> is_period_dtype(PeriodDtype(freq="D"))
    True
    >>> is_period_dtype([1, 2, 3])
    False
    >>> is_period_dtype(pd.Period("2017-01-01"))
    False
    >>> is_period_dtype(pd.PeriodIndex([], freq="A"))
    True
    """

    # TODO: Consider making Period an instance of PeriodDtype
    if arr_or_dtype is None:
        return False
    return PeriodDtype.is_dtype(arr_or_dtype)


def is_interval_dtype(arr_or_dtype):
    """
    Check whether an array-like or dtype is of the Interval dtype.

    Parameters
    ----------
    arr_or_dtype : array-like
        The array-like or dtype to check.

    Returns
    -------
    boolean : Whether or not the array-like or dtype is
              of the Interval dtype.

    Examples
    --------
    >>> is_interval_dtype(object)
    False
    >>> is_interval_dtype(IntervalDtype())
    True
    >>> is_interval_dtype([1, 2, 3])
    False
    >>>
    >>> interval = pd.Interval(1, 2, closed="right")
    >>> is_interval_dtype(interval)
    False
    >>> is_interval_dtype(pd.IntervalIndex([interval]))
    True
    """

    # TODO: Consider making Interval an instance of IntervalDtype
    if arr_or_dtype is None:
        return False
    return IntervalDtype.is_dtype(arr_or_dtype)


def is_categorical_dtype(arr_or_dtype):
    """
    Check whether an array-like or dtype is of the Categorical dtype.

    Parameters
    ----------
    arr_or_dtype : array-like
        The array-like or dtype to check.

    Returns
    -------
    boolean : Whether or not the array-like or dtype is
              of the Categorical dtype.

    Examples
    --------
    >>> is_categorical_dtype(object)
    False
    >>> is_categorical_dtype(CategoricalDtype())
    True
    >>> is_categorical_dtype([1, 2, 3])
    False
    >>> is_categorical_dtype(pd.Categorical([1, 2, 3]))
    True
    >>> is_categorical_dtype(pd.CategoricalIndex([1, 2, 3]))
    True
    """

    if arr_or_dtype is None:
        return False
    return CategoricalDtype.is_dtype(arr_or_dtype)


def is_string_dtype(arr_or_dtype):
    """
    Check whether the provided array or dtype is of the string dtype.

    Parameters
    ----------
    arr_or_dtype : array-like
        The array or dtype to check.

    Returns
    -------
    boolean : Whether or not the array or dtype is of the string dtype.

    Examples
    --------
    >>> is_string_dtype(str)
    True
    >>> is_string_dtype(object)
    True
    >>> is_string_dtype(int)
    False
    >>>
    >>> is_string_dtype(np.array(['a', 'b']))
    True
    >>> is_string_dtype(pd.Series([1, 2]))
    False
    """

    # TODO: gh-15585: consider making the checks stricter.

    if arr_or_dtype is None:
        return False
    try:
        dtype = _get_dtype(arr_or_dtype)
        return dtype.kind in ('O', 'S', 'U') and not is_period_dtype(dtype)
    except TypeError:
        return False


def is_period_arraylike(arr):
    """
    Check whether an array-like is a periodical array-like or PeriodIndex.

    Parameters
    ----------
    arr : array-like
        The array-like to check.

    Returns
    -------
    boolean : Whether or not the array-like is a periodical
              array-like or PeriodIndex instance.

    Examples
    --------
    >>> is_period_arraylike([1, 2, 3])
    False
    >>> is_period_arraylike(pd.Index([1, 2, 3]))
    False
    >>> is_period_arraylike(pd.PeriodIndex(["2017-01-01"], freq="D"))
    True
    """

    if isinstance(arr, ABCPeriodIndex):
        return True
    elif isinstance(arr, (np.ndarray, ABCSeries)):
        return arr.dtype == object and lib.infer_dtype(arr) == 'period'
    return getattr(arr, 'inferred_type', None) == 'period'


def is_datetime_arraylike(arr):
    """
    Check whether an array-like is a datetime array-like or DatetimeIndex.

    Parameters
    ----------
    arr : array-like
        The array-like to check.

    Returns
    -------
    boolean : Whether or not the array-like is a datetime
              array-like or DatetimeIndex.

    Examples
    --------
    >>> is_datetime_arraylike([1, 2, 3])
    False
    >>> is_datetime_arraylike(pd.Index([1, 2, 3]))
    False
    >>> is_datetime_arraylike(pd.DatetimeIndex([1, 2, 3]))
    True
    """

    if isinstance(arr, ABCDatetimeIndex):
        return True
    elif isinstance(arr, (np.ndarray, ABCSeries)):
        return arr.dtype == object and lib.infer_dtype(arr) == 'datetime'
    return getattr(arr, 'inferred_type', None) == 'datetime'


def is_datetimelike(arr):
    """
    Check whether an array-like is a datetime-like array-like.

    Acceptable datetime-like objects are (but not limited to) datetime
    indices, periodic indices, and timedelta indices.

    Parameters
    ----------
    arr : array-like
        The array-like to check.

    Returns
    -------
    boolean : Whether or not the array-like is a datetime-like array-like.

    Examples
    --------
    >>> is_datetimelike([1, 2, 3])
    False
    >>> is_datetimelike(pd.Index([1, 2, 3]))
    False
    >>> is_datetimelike(pd.DatetimeIndex([1, 2, 3]))
    True
    >>> is_datetimelike(pd.DatetimeIndex([1, 2, 3], tz="US/Eastern"))
    True
    >>> is_datetimelike(pd.PeriodIndex([], freq="A"))
    True
    >>> is_datetimelike(np.array([], dtype=np.datetime64))
    True
    >>> is_datetimelike(pd.Series([], dtype="timedelta64[ns]"))
    True
    >>>
    >>> dtype = DatetimeTZDtype("ns", tz="US/Eastern")
    >>> s = pd.Series([], dtype=dtype)
    >>> is_datetimelike(s)
    True
    """

    return (is_datetime64_dtype(arr) or is_datetime64tz_dtype(arr) or
            is_timedelta64_dtype(arr) or
            isinstance(arr, ABCPeriodIndex) or
            is_datetimetz(arr))


def is_dtype_equal(source, target):
    """
    Check if two dtypes are equal.

    Parameters
    ----------
    source : The first dtype to compare
    target : The second dtype to compare

    Returns
    ----------
    boolean : Whether or not the two dtypes are equal.

    Examples
    --------
    >>> is_dtype_equal(int, float)
    False
    >>> is_dtype_equal("int", int)
    True
    >>> is_dtype_equal(object, "category")
    False
    >>> is_dtype_equal(CategoricalDtype(), "category")
    True
    >>> is_dtype_equal(DatetimeTZDtype(), "datetime64")
    False
    """

    try:
        source = _get_dtype(source)
        target = _get_dtype(target)
        return source == target
    except (TypeError, AttributeError):

        # invalid comparison
        # object == category will hit this
        return False


def is_any_int_dtype(arr_or_dtype):
    """
    DEPRECATED: This function will be removed in a future version.

    Check whether the provided array or dtype is of an integer dtype.

    In this function, timedelta64 instances are also considered "any-integer"
    type objects and will return True.

    Parameters
    ----------
    arr_or_dtype : array-like
        The array or dtype to check.

    Returns
    -------
    boolean : Whether or not the array or dtype is of an integer dtype.

    Examples
    --------
    >>> is_any_int_dtype(str)
    False
    >>> is_any_int_dtype(int)
    True
    >>> is_any_int_dtype(float)
    False
    >>> is_any_int_dtype(np.uint64)
    True
    >>> is_any_int_dtype(np.datetime64)
    False
    >>> is_any_int_dtype(np.timedelta64)
    True
    >>> is_any_int_dtype(np.array(['a', 'b']))
    False
    >>> is_any_int_dtype(pd.Series([1, 2]))
    True
    >>> is_any_int_dtype(np.array([], dtype=np.timedelta64))
    True
    >>> is_any_int_dtype(pd.Index([1, 2.]))  # float
    False
    """

    if arr_or_dtype is None:
        return False
    tipo = _get_dtype_type(arr_or_dtype)
    return issubclass(tipo, np.integer)


def is_integer_dtype(arr_or_dtype):
    """
    Check whether the provided array or dtype is of an integer dtype.

    Unlike in `in_any_int_dtype`, timedelta64 instances will return False.

    Parameters
    ----------
    arr_or_dtype : array-like
        The array or dtype to check.

    Returns
    -------
    boolean : Whether or not the array or dtype is of an integer dtype
              and not an instance of timedelta64.

    Examples
    --------
    >>> is_integer_dtype(str)
    False
    >>> is_integer_dtype(int)
    True
    >>> is_integer_dtype(float)
    False
    >>> is_integer_dtype(np.uint64)
    True
    >>> is_integer_dtype(np.datetime64)
    False
    >>> is_integer_dtype(np.timedelta64)
    False
    >>> is_integer_dtype(np.array(['a', 'b']))
    False
    >>> is_integer_dtype(pd.Series([1, 2]))
    True
    >>> is_integer_dtype(np.array([], dtype=np.timedelta64))
    False
    >>> is_integer_dtype(pd.Index([1, 2.]))  # float
    False
    """

    if arr_or_dtype is None:
        return False
    tipo = _get_dtype_type(arr_or_dtype)
    return (issubclass(tipo, np.integer) and
            not issubclass(tipo, (np.datetime64, np.timedelta64)))


def is_signed_integer_dtype(arr_or_dtype):
    """
    Check whether the provided array or dtype is of a signed integer dtype.

    Unlike in `in_any_int_dtype`, timedelta64 instances will return False.

    Parameters
    ----------
    arr_or_dtype : array-like
        The array or dtype to check.

    Returns
    -------
    boolean : Whether or not the array or dtype is of a signed integer dtype
              and not an instance of timedelta64.

    Examples
    --------
    >>> is_signed_integer_dtype(str)
    False
    >>> is_signed_integer_dtype(int)
    True
    >>> is_signed_integer_dtype(float)
    False
    >>> is_signed_integer_dtype(np.uint64)  # unsigned
    False
    >>> is_signed_integer_dtype(np.datetime64)
    False
    >>> is_signed_integer_dtype(np.timedelta64)
    False
    >>> is_signed_integer_dtype(np.array(['a', 'b']))
    False
    >>> is_signed_integer_dtype(pd.Series([1, 2]))
    True
    >>> is_signed_integer_dtype(np.array([], dtype=np.timedelta64))
    False
    >>> is_signed_integer_dtype(pd.Index([1, 2.]))  # float
    False
    >>> is_signed_integer_dtype(np.array([1, 2], dtype=np.uint32))  # unsigned
    False
    """

    if arr_or_dtype is None:
        return False
    tipo = _get_dtype_type(arr_or_dtype)
    return (issubclass(tipo, np.signedinteger) and
            not issubclass(tipo, (np.datetime64, np.timedelta64)))


def is_unsigned_integer_dtype(arr_or_dtype):
    """
    Check whether the provided array or dtype is of an unsigned integer dtype.

    Parameters
    ----------
    arr_or_dtype : array-like
        The array or dtype to check.

    Returns
    -------
    boolean : Whether or not the array or dtype is of an
              unsigned integer dtype.

    Examples
    --------
    >>> is_unsigned_integer_dtype(str)
    False
    >>> is_unsigned_integer_dtype(int)  # signed
    False
    >>> is_unsigned_integer_dtype(float)
    False
    >>> is_unsigned_integer_dtype(np.uint64)
    True
    >>> is_unsigned_integer_dtype(np.array(['a', 'b']))
    False
    >>> is_unsigned_integer_dtype(pd.Series([1, 2]))  # signed
    False
    >>> is_unsigned_integer_dtype(pd.Index([1, 2.]))  # float
    False
    >>> is_unsigned_integer_dtype(np.array([1, 2], dtype=np.uint32))
    True
    """

    if arr_or_dtype is None:
        return False
    tipo = _get_dtype_type(arr_or_dtype)
    return (issubclass(tipo, np.unsignedinteger) and
            not issubclass(tipo, (np.datetime64, np.timedelta64)))


def is_int64_dtype(arr_or_dtype):
    """
    Check whether the provided array or dtype is of the int64 dtype.

    Parameters
    ----------
    arr_or_dtype : array-like
        The array or dtype to check.

    Returns
    -------
    boolean : Whether or not the array or dtype is of the int64 dtype.

    Notes
    -----
    Depending on system architecture, the return value of `is_int64_dtype(
    int)` will be True if the OS uses 64-bit integers and False if the OS
    uses 32-bit integers.

    Examples
    --------
    >>> is_int64_dtype(str)
    False
    >>> is_int64_dtype(np.int32)
    False
    >>> is_int64_dtype(np.int64)
    True
    >>> is_int64_dtype(float)
    False
    >>> is_int64_dtype(np.uint64)  # unsigned
    False
    >>> is_int64_dtype(np.array(['a', 'b']))
    False
    >>> is_int64_dtype(np.array([1, 2], dtype=np.int64))
    True
    >>> is_int64_dtype(pd.Index([1, 2.]))  # float
    False
    >>> is_int64_dtype(np.array([1, 2], dtype=np.uint32))  # unsigned
    False
    """

    if arr_or_dtype is None:
        return False
    tipo = _get_dtype_type(arr_or_dtype)
    return issubclass(tipo, np.int64)


def is_int_or_datetime_dtype(arr_or_dtype):
    """
    Check whether the provided array or dtype is of an
    integer, timedelta64, or datetime64 dtype.

    Parameters
    ----------
    arr_or_dtype : array-like
        The array or dtype to check.

    Returns
    -------
    boolean : Whether or not the array or dtype is of an
              integer, timedelta64, or datetime64 dtype.

    Examples
    --------
    >>> is_int_or_datetime_dtype(str)
    False
    >>> is_int_or_datetime_dtype(int)
    True
    >>> is_int_or_datetime_dtype(float)
    False
    >>> is_int_or_datetime_dtype(np.uint64)
    True
    >>> is_int_or_datetime_dtype(np.datetime64)
    True
    >>> is_int_or_datetime_dtype(np.timedelta64)
    True
    >>> is_int_or_datetime_dtype(np.array(['a', 'b']))
    False
    >>> is_int_or_datetime_dtype(pd.Series([1, 2]))
    True
    >>> is_int_or_datetime_dtype(np.array([], dtype=np.timedelta64))
    True
    >>> is_int_or_datetime_dtype(np.array([], dtype=np.datetime64))
    True
    >>> is_int_or_datetime_dtype(pd.Index([1, 2.]))  # float
    False
    """

    if arr_or_dtype is None:
        return False
    tipo = _get_dtype_type(arr_or_dtype)
    return (issubclass(tipo, np.integer) or
            issubclass(tipo, (np.datetime64, np.timedelta64)))


def is_datetime64_any_dtype(arr_or_dtype):
    """
    Check whether the provided array or dtype is of the datetime64 dtype.

    Parameters
    ----------
    arr_or_dtype : array-like
        The array or dtype to check.

    Returns
    -------
    boolean : Whether or not the array or dtype is of the datetime64 dtype.

    Examples
    --------
    >>> is_datetime64_any_dtype(str)
    False
    >>> is_datetime64_any_dtype(int)
    False
    >>> is_datetime64_any_dtype(np.datetime64)  # can be tz-naive
    True
    >>> is_datetime64_any_dtype(DatetimeTZDtype("ns", "US/Eastern"))
    True
    >>> is_datetime64_any_dtype(np.array(['a', 'b']))
    False
    >>> is_datetime64_any_dtype(np.array([1, 2]))
    False
    >>> is_datetime64_any_dtype(np.array([], dtype=np.datetime64))
    True
    >>> is_datetime64_any_dtype(pd.DatetimeIndex([1, 2, 3],
                                dtype=np.datetime64))
    True
    """

    if arr_or_dtype is None:
        return False
    return (is_datetime64_dtype(arr_or_dtype) or
            is_datetime64tz_dtype(arr_or_dtype))


def is_datetime64_ns_dtype(arr_or_dtype):
    """
    Check whether the provided array or dtype is of the datetime64[ns] dtype.

    Parameters
    ----------
    arr_or_dtype : array-like
        The array or dtype to check.

    Returns
    -------
    boolean : Whether or not the array or dtype is of the datetime64[ns] dtype.

    Examples
    --------
    >>> is_datetime64_ns_dtype(str)
    False
    >>> is_datetime64_ns_dtype(int)
    False
    >>> is_datetime64_ns_dtype(np.datetime64)  # no unit
    False
    >>> is_datetime64_ns_dtype(DatetimeTZDtype("ns", "US/Eastern"))
    True
    >>> is_datetime64_ns_dtype(np.array(['a', 'b']))
    False
    >>> is_datetime64_ns_dtype(np.array([1, 2]))
    False
    >>> is_datetime64_ns_dtype(np.array([], dtype=np.datetime64))  # no unit
    False
    >>> is_datetime64_ns_dtype(np.array([],
                               dtype="datetime64[ps]"))  # wrong unit
    False
    >>> is_datetime64_ns_dtype(pd.DatetimeIndex([1, 2, 3],
                               dtype=np.datetime64))  # has 'ns' unit
    True
    """

    if arr_or_dtype is None:
        return False
    try:
        tipo = _get_dtype(arr_or_dtype)
    except TypeError:
        if is_datetime64tz_dtype(arr_or_dtype):
            tipo = _get_dtype(arr_or_dtype.dtype)
        else:
            return False
    return tipo == _NS_DTYPE or getattr(tipo, 'base', None) == _NS_DTYPE


def is_timedelta64_ns_dtype(arr_or_dtype):
    """
    Check whether the provided array or dtype is of the timedelta64[ns] dtype.

    This is a very specific dtype, so generic ones like `np.timedelta64`
    will return False if passed into this function.

    Parameters
    ----------
    arr_or_dtype : array-like
        The array or dtype to check.

    Returns
    -------
    boolean : Whether or not the array or dtype is of the
              timedelta64[ns] dtype.

    Examples
    --------
    >>> is_timedelta64_ns_dtype(np.dtype('m8[ns]'))
    True
    >>> is_timedelta64_ns_dtype(np.dtype('m8[ps]'))  # Wrong frequency
    False
    >>> is_timedelta64_ns_dtype(np.array([1, 2], dtype='m8[ns]'))
    True
    >>> is_timedelta64_ns_dtype(np.array([1, 2], dtype=np.timedelta64))
    False
    """

    if arr_or_dtype is None:
        return False
    try:
        tipo = _get_dtype(arr_or_dtype)
        return tipo == _TD_DTYPE
    except TypeError:
        return False


def is_datetime_or_timedelta_dtype(arr_or_dtype):
    """
    Check whether the provided array or dtype is of
    a timedelta64 or datetime64 dtype.

    Parameters
    ----------
    arr_or_dtype : array-like
        The array or dtype to check.

    Returns
    -------
    boolean : Whether or not the array or dtype is of a
              timedelta64, or datetime64 dtype.

    Examples
    --------
    >>> is_datetime_or_timedelta_dtype(str)
    False
    >>> is_datetime_or_timedelta_dtype(int)
    False
    >>> is_datetime_or_timedelta_dtype(np.datetime64)
    True
    >>> is_datetime_or_timedelta_dtype(np.timedelta64)
    True
    >>> is_datetime_or_timedelta_dtype(np.array(['a', 'b']))
    False
    >>> is_datetime_or_timedelta_dtype(pd.Series([1, 2]))
    False
    >>> is_datetime_or_timedelta_dtype(np.array([], dtype=np.timedelta64))
    True
    >>> is_datetime_or_timedelta_dtype(np.array([], dtype=np.datetime64))
    True
    """

    if arr_or_dtype is None:
        return False
    tipo = _get_dtype_type(arr_or_dtype)
    return issubclass(tipo, (np.datetime64, np.timedelta64))


def _is_unorderable_exception(e):
    """
    Check if the exception raised is an unorderable exception.

    The error message differs for 3 <= PY <= 3.5 and PY >= 3.6, so
    we need to condition based on Python version.

    Parameters
    ----------
    e : Exception or sub-class
        The exception object to check.

    Returns
    -------
    boolean : Whether or not the exception raised is an unorderable exception.
    """

    if PY36:
        return "'>' not supported between instances of" in str(e)

    elif PY3:
        return 'unorderable' in str(e)
    return False


def is_numeric_v_string_like(a, b):
    """
    Check if we are comparing a string-like object to a numeric ndarray.

    NumPy doesn't like to compare such objects, especially numeric arrays
    and scalar string-likes.

    Parameters
    ----------
    a : array-like, scalar
        The first object to check.
    b : array-like, scalar
        The second object to check.

    Returns
    -------
    boolean : Whether we return a comparing a string-like
              object to a numeric array.

    Examples
    --------
    >>> is_numeric_v_string_like(1, 1)
    False
    >>> is_numeric_v_string_like("foo", "foo")
    False
    >>> is_numeric_v_string_like(1, "foo")  # non-array numeric
    False
    >>> is_numeric_v_string_like(np.array([1]), "foo")
    True
    >>> is_numeric_v_string_like("foo", np.array([1]))  # symmetric check
    True
    >>> is_numeric_v_string_like(np.array([1, 2]), np.array(["foo"]))
    True
    >>> is_numeric_v_string_like(np.array(["foo"]), np.array([1, 2]))
    True
    >>> is_numeric_v_string_like(np.array([1]), np.array([2]))
    False
    >>> is_numeric_v_string_like(np.array(["foo"]), np.array(["foo"]))
    False
    """

    is_a_array = isinstance(a, np.ndarray)
    is_b_array = isinstance(b, np.ndarray)

    is_a_numeric_array = is_a_array and is_numeric_dtype(a)
    is_b_numeric_array = is_b_array and is_numeric_dtype(b)
    is_a_string_array = is_a_array and is_string_like_dtype(a)
    is_b_string_array = is_b_array and is_string_like_dtype(b)

    is_a_scalar_string_like = not is_a_array and is_string_like(a)
    is_b_scalar_string_like = not is_b_array and is_string_like(b)

    return ((is_a_numeric_array and is_b_scalar_string_like) or
            (is_b_numeric_array and is_a_scalar_string_like) or
            (is_a_numeric_array and is_b_string_array) or
            (is_b_numeric_array and is_a_string_array))


def is_datetimelike_v_numeric(a, b):
    """
    Check if we are comparing a datetime-like object to a numeric object.

    By "numeric," we mean an object that is either of an int or float dtype.

    Parameters
    ----------
    a : array-like, scalar
        The first object to check.
    b : array-like, scalar
        The second object to check.

    Returns
    -------
    boolean : Whether we return a comparing a datetime-like
              to a numeric object.

    Examples
    --------
    >>> dt = np.datetime64(pd.datetime(2017, 1, 1))
    >>>
    >>> is_datetimelike_v_numeric(1, 1)
    False
    >>> is_datetimelike_v_numeric(dt, dt)
    False
    >>> is_datetimelike_v_numeric(1, dt)
    True
    >>> is_datetimelike_v_numeric(dt, 1)  # symmetric check
    True
    >>> is_datetimelike_v_numeric(np.array([dt]), 1)
    True
    >>> is_datetimelike_v_numeric(np.array([1]), dt)
    True
    >>> is_datetimelike_v_numeric(np.array([dt]), np.array([1]))
    True
    >>> is_datetimelike_v_numeric(np.array([1]), np.array([2]))
    False
    >>> is_datetimelike_v_numeric(np.array([dt]), np.array([dt]))
    False
    """

    if not hasattr(a, 'dtype'):
        a = np.asarray(a)
    if not hasattr(b, 'dtype'):
        b = np.asarray(b)

    def is_numeric(x):
        """
        Check if an object has a numeric dtype (i.e. integer or float).
        """
        return is_integer_dtype(x) or is_float_dtype(x)

    is_datetimelike = needs_i8_conversion
    return ((is_datetimelike(a) and is_numeric(b)) or
            (is_datetimelike(b) and is_numeric(a)))


def is_datetimelike_v_object(a, b):
    """
    Check if we are comparing a datetime-like object to an object instance.

    Parameters
    ----------
    a : array-like, scalar
        The first object to check.
    b : array-like, scalar
        The second object to check.

    Returns
    -------
    boolean : Whether we return a comparing a datetime-like
              to an object instance.

    Examples
    --------
    >>> obj = object()
    >>> dt = np.datetime64(pd.datetime(2017, 1, 1))
    >>>
    >>> is_datetimelike_v_object(obj, obj)
    False
    >>> is_datetimelike_v_object(dt, dt)
    False
    >>> is_datetimelike_v_object(obj, dt)
    True
    >>> is_datetimelike_v_object(dt, obj)  # symmetric check
    True
    >>> is_datetimelike_v_object(np.array([dt]), obj)
    True
    >>> is_datetimelike_v_object(np.array([obj]), dt)
    True
    >>> is_datetimelike_v_object(np.array([dt]), np.array([obj]))
    True
    >>> is_datetimelike_v_object(np.array([obj]), np.array([obj]))
    False
    >>> is_datetimelike_v_object(np.array([dt]), np.array([1]))
    False
    >>> is_datetimelike_v_object(np.array([dt]), np.array([dt]))
    False
    """

    if not hasattr(a, 'dtype'):
        a = np.asarray(a)
    if not hasattr(b, 'dtype'):
        b = np.asarray(b)

    is_datetimelike = needs_i8_conversion
    return ((is_datetimelike(a) and is_object_dtype(b)) or
            (is_datetimelike(b) and is_object_dtype(a)))


def needs_i8_conversion(arr_or_dtype):
    """
    Check whether the array or dtype should be converted to int64.

    An array-like or dtype "needs" such a conversion if the array-like
    or dtype is of a datetime-like dtype

    Parameters
    ----------
    arr_or_dtype : array-like
        The array or dtype to check.

    Returns
    -------
    boolean : Whether or not the array or dtype should be converted to int64.

    Examples
    --------
    >>> needs_i8_conversion(str)
    False
    >>> needs_i8_conversion(np.int64)
    False
    >>> needs_i8_conversion(np.datetime64)
    True
    >>> needs_i8_conversion(np.array(['a', 'b']))
    False
    >>> needs_i8_conversion(pd.Series([1, 2]))
    False
    >>> needs_i8_conversion(pd.Series([], dtype="timedelta64[ns]"))
    True
    >>> needs_i8_conversion(pd.DatetimeIndex([1, 2, 3], tz="US/Eastern"))
    True
    """

    if arr_or_dtype is None:
        return False
    return (is_datetime_or_timedelta_dtype(arr_or_dtype) or
            is_datetime64tz_dtype(arr_or_dtype) or
            is_period_dtype(arr_or_dtype))


def is_numeric_dtype(arr_or_dtype):
    """
    Check whether the provided array or dtype is of a numeric dtype.

    Parameters
    ----------
    arr_or_dtype : array-like
        The array or dtype to check.

    Returns
    -------
    boolean : Whether or not the array or dtype is of a numeric dtype.

    Examples
    --------
    >>> is_numeric_dtype(str)
    False
    >>> is_numeric_dtype(int)
    True
    >>> is_numeric_dtype(float)
    True
    >>> is_numeric_dtype(np.uint64)
    True
    >>> is_numeric_dtype(np.datetime64)
    False
    >>> is_numeric_dtype(np.timedelta64)
    False
    >>> is_numeric_dtype(np.array(['a', 'b']))
    False
    >>> is_numeric_dtype(pd.Series([1, 2]))
    True
    >>> is_numeric_dtype(pd.Index([1, 2.]))
    True
    >>> is_numeric_dtype(np.array([], dtype=np.timedelta64))
    False
    """

    if arr_or_dtype is None:
        return False
    tipo = _get_dtype_type(arr_or_dtype)
    return (issubclass(tipo, (np.number, np.bool_)) and
            not issubclass(tipo, (np.datetime64, np.timedelta64)))


def is_string_like_dtype(arr_or_dtype):
    """
    Check whether the provided array or dtype is of a string-like dtype.

    Unlike `is_string_dtype`, the object dtype is excluded because it
    is a mixed dtype.

    Parameters
    ----------
    arr_or_dtype : array-like
        The array or dtype to check.

    Returns
    -------
    boolean : Whether or not the array or dtype is of the string dtype.

    Examples
    --------
    >>> is_string_like_dtype(str)
    True
    >>> is_string_like_dtype(object)
    False
    >>> is_string_like_dtype(np.array(['a', 'b']))
    True
    >>> is_string_like_dtype(pd.Series([1, 2]))
    False
    """

    if arr_or_dtype is None:
        return False
    try:
        dtype = _get_dtype(arr_or_dtype)
        return dtype.kind in ('S', 'U')
    except TypeError:
        return False


def is_float_dtype(arr_or_dtype):
    """
    Check whether the provided array or dtype is of a float dtype.

    Parameters
    ----------
    arr_or_dtype : array-like
        The array or dtype to check.

    Returns
    -------
    boolean : Whether or not the array or dtype is of a float dtype.

    Examples
    --------
    >>> is_float_dtype(str)
    False
    >>> is_float_dtype(int)
    False
    >>> is_float_dtype(float)
    True
    >>> is_float_dtype(np.array(['a', 'b']))
    False
    >>> is_float_dtype(pd.Series([1, 2]))
    False
    >>> is_float_dtype(pd.Index([1, 2.]))
    True
    """

    if arr_or_dtype is None:
        return False
    tipo = _get_dtype_type(arr_or_dtype)
    return issubclass(tipo, np.floating)


def is_floating_dtype(arr_or_dtype):
    """
    DEPRECATED: This function will be removed in a future version.

    Check whether the provided array or dtype is an instance of
    numpy's float dtype.

    Unlike, `is_float_dtype`, this check is a lot stricter, as it requires
    `isinstance` of `np.floating` and not `issubclass`.
    """

    if arr_or_dtype is None:
        return False
    tipo = _get_dtype_type(arr_or_dtype)
    return isinstance(tipo, np.floating)


def is_bool_dtype(arr_or_dtype):
    """
    Check whether the provided array or dtype is of a boolean dtype.

    Parameters
    ----------
    arr_or_dtype : array-like
        The array or dtype to check.

    Returns
    -------
    boolean : Whether or not the array or dtype is of a boolean dtype.

    Examples
    --------
    >>> is_bool_dtype(str)
    False
    >>> is_bool_dtype(int)
    False
    >>> is_bool_dtype(bool)
    True
    >>> is_bool_dtype(np.bool)
    True
    >>> is_bool_dtype(np.array(['a', 'b']))
    False
    >>> is_bool_dtype(pd.Series([1, 2]))
    False
    >>> is_bool_dtype(np.array([True, False]))
    True
    """

    if arr_or_dtype is None:
        return False
    try:
        tipo = _get_dtype_type(arr_or_dtype)
    except ValueError:
        # this isn't even a dtype
        return False
    return issubclass(tipo, np.bool_)


def is_extension_type(arr):
    """
    Check whether an array-like is of a pandas extension class instance.

    Extension classes include categoricals, pandas sparse objects (i.e.
    classes represented within the pandas library and not ones external
    to it like scipy sparse matrices), and datetime-like arrays.

    Parameters
    ----------
    arr : array-like
        The array-like to check.

    Returns
    -------
    boolean : Whether or not the array-like is of a pandas
              extension class instance.

    Examples
    --------
    >>> is_extension_type([1, 2, 3])
    False
    >>> is_extension_type(np.array([1, 2, 3]))
    False
    >>>
    >>> cat = pd.Categorical([1, 2, 3])
    >>>
    >>> is_extension_type(cat)
    True
    >>> is_extension_type(pd.Series(cat))
    True
    >>> is_extension_type(pd.SparseArray([1, 2, 3]))
    True
    >>> is_extension_type(pd.SparseSeries([1, 2, 3]))
    True
    >>>
    >>> from scipy.sparse import bsr_matrix
    >>> is_extension_type(bsr_matrix([1, 2, 3]))
    False
    >>> is_extension_type(pd.DatetimeIndex([1, 2, 3]))
    False
    >>> is_extension_type(pd.DatetimeIndex([1, 2, 3], tz="US/Eastern"))
    True
    >>>
    >>> dtype = DatetimeTZDtype("ns", tz="US/Eastern")
    >>> s = pd.Series([], dtype=dtype)
    >>> is_extension_type(s)
    True
    """

    if is_categorical(arr):
        return True
    elif is_sparse(arr):
        return True
    elif is_datetimetz(arr):
        return True
    return False


def is_complex_dtype(arr_or_dtype):
    """
    Check whether the provided array or dtype is of a complex dtype.

    Parameters
    ----------
    arr_or_dtype : array-like
        The array or dtype to check.

    Returns
    -------
    boolean : Whether or not the array or dtype is of a compex dtype.

    Examples
    --------
    >>> is_complex_dtype(str)
    False
    >>> is_complex_dtype(int)
    False
    >>> is_complex_dtype(np.complex)
    True
    >>> is_complex_dtype(np.array(['a', 'b']))
    False
    >>> is_complex_dtype(pd.Series([1, 2]))
    False
    >>> is_complex_dtype(np.array([1 + 1j, 5]))
    True
    """

    if arr_or_dtype is None:
        return False
    tipo = _get_dtype_type(arr_or_dtype)
    return issubclass(tipo, np.complexfloating)


def _coerce_to_dtype(dtype):
    """
    Coerce a string or np.dtype to a pandas or numpy
    dtype if possible.

    If we cannot convert to a pandas dtype initially,
    we convert to a numpy dtype.

    Parameters
    ----------
    dtype : The dtype that we want to coerce.

    Returns
    -------
    pd_or_np_dtype : The coerced dtype.
    """

    if is_categorical_dtype(dtype):
        dtype = CategoricalDtype()
    elif is_datetime64tz_dtype(dtype):
        dtype = DatetimeTZDtype(dtype)
    elif is_period_dtype(dtype):
        dtype = PeriodDtype(dtype)
    elif is_interval_dtype(dtype):
        dtype = IntervalDtype(dtype)
    else:
        dtype = np.dtype(dtype)
    return dtype


def _get_dtype(arr_or_dtype):
    """
    Get the dtype instance associated with an array
    or dtype object.

    Parameters
    ----------
    arr_or_dtype : array-like
        The array-like or dtype object whose dtype we want to extract.

    Returns
    -------
    obj_dtype : The extract dtype instance from the
                passed in array or dtype object.

    Raises
    ------
    TypeError : The passed in object is None.
    """

    if arr_or_dtype is None:
        raise TypeError("Cannot deduce dtype from null object")
    if isinstance(arr_or_dtype, np.dtype):
        return arr_or_dtype
    elif isinstance(arr_or_dtype, type):
        return np.dtype(arr_or_dtype)
    elif isinstance(arr_or_dtype, CategoricalDtype):
        return arr_or_dtype
    elif isinstance(arr_or_dtype, DatetimeTZDtype):
        return arr_or_dtype
    elif isinstance(arr_or_dtype, PeriodDtype):
        return arr_or_dtype
    elif isinstance(arr_or_dtype, IntervalDtype):
        return arr_or_dtype
    elif isinstance(arr_or_dtype, string_types):
        if is_categorical_dtype(arr_or_dtype):
            return CategoricalDtype.construct_from_string(arr_or_dtype)
        elif is_datetime64tz_dtype(arr_or_dtype):
            return DatetimeTZDtype.construct_from_string(arr_or_dtype)
        elif is_period_dtype(arr_or_dtype):
            return PeriodDtype.construct_from_string(arr_or_dtype)
        elif is_interval_dtype(arr_or_dtype):
            return IntervalDtype.construct_from_string(arr_or_dtype)

    if hasattr(arr_or_dtype, 'dtype'):
        arr_or_dtype = arr_or_dtype.dtype
    return np.dtype(arr_or_dtype)


def _get_dtype_type(arr_or_dtype):
    """
    Get the type (NOT dtype) instance associated with
    an array or dtype object.

    Parameters
    ----------
    arr_or_dtype : array-like
        The array-like or dtype object whose type we want to extract.

    Returns
    -------
    obj_type : The extract type instance from the
               passed in array or dtype object.
    """

    if isinstance(arr_or_dtype, np.dtype):
        return arr_or_dtype.type
    elif isinstance(arr_or_dtype, type):
        return np.dtype(arr_or_dtype).type
    elif isinstance(arr_or_dtype, CategoricalDtype):
        return CategoricalDtypeType
    elif isinstance(arr_or_dtype, DatetimeTZDtype):
        return DatetimeTZDtypeType
    elif isinstance(arr_or_dtype, IntervalDtype):
        return IntervalDtypeType
    elif isinstance(arr_or_dtype, PeriodDtype):
        return PeriodDtypeType
    elif isinstance(arr_or_dtype, string_types):
        if is_categorical_dtype(arr_or_dtype):
            return CategoricalDtypeType
        elif is_datetime64tz_dtype(arr_or_dtype):
            return DatetimeTZDtypeType
        elif is_period_dtype(arr_or_dtype):
            return PeriodDtypeType
        elif is_interval_dtype(arr_or_dtype):
            return IntervalDtypeType
        return _get_dtype_type(np.dtype(arr_or_dtype))
    try:
        return arr_or_dtype.dtype.type
    except AttributeError:
        return type(None)


def _get_dtype_from_object(dtype):
    """
    Get a numpy dtype.type-style object for a dtype object.

    This methods also includes handling of the datetime64[ns] and
    datetime64[ns, TZ] objects.

    If no dtype can be found, we return ``object``.

    Parameters
    ----------
    dtype : dtype, type
        The dtype object whose numpy dtype.type-style
        object we want to extract.

    Returns
    -------
    dtype_object : The extracted numpy dtype.type-style object.
    """

    if isinstance(dtype, type) and issubclass(dtype, np.generic):
        # Type object from a dtype
        return dtype
    elif is_categorical(dtype):
        return CategoricalDtype().type
    elif is_datetimetz(dtype):
        return DatetimeTZDtype(dtype).type
    elif isinstance(dtype, np.dtype):  # dtype object
        try:
            _validate_date_like_dtype(dtype)
        except TypeError:
            # Should still pass if we don't have a date-like
            pass
        return dtype.type
    elif isinstance(dtype, string_types):
        if dtype in ['datetimetz', 'datetime64tz']:
            return DatetimeTZDtype.type
        elif dtype in ['period']:
            raise NotImplementedError

        if dtype == 'datetime' or dtype == 'timedelta':
            dtype += '64'

        try:
            return _get_dtype_from_object(getattr(np, dtype))
        except (AttributeError, TypeError):
            # Handles cases like _get_dtype(int) i.e.,
            # Python objects that are valid dtypes
            # (unlike user-defined types, in general)
            #
            # TypeError handles the float16 type code of 'e'
            # further handle internal types
            pass

    return _get_dtype_from_object(np.dtype(dtype))


def _validate_date_like_dtype(dtype):
    """
    Check whether the dtype is a date-like dtype. Raises an error if invalid.

    Parameters
    ----------
    dtype : dtype, type
        The dtype to check.

    Raises
    ------
    TypeError : The dtype could not be casted to a date-like dtype.
    ValueError : The dtype is an illegal date-like dtype (e.g. the
                 the frequency provided is too specific)
    """

    try:
        typ = np.datetime_data(dtype)[0]
    except ValueError as e:
        raise TypeError('%s' % e)
    if typ != 'generic' and typ != 'ns':
        raise ValueError('%r is too specific of a frequency, try passing %r' %
                         (dtype.name, dtype.type.__name__))


_string_dtypes = frozenset(map(_get_dtype_from_object, (binary_type,
                                                        text_type)))


def pandas_dtype(dtype):
    """
    Converts input into a pandas only dtype object or a numpy dtype object.

    Parameters
    ----------
    dtype : object to be converted

    Returns
    -------
    np.dtype or a pandas dtype
    """

    if isinstance(dtype, DatetimeTZDtype):
        return dtype
    elif isinstance(dtype, PeriodDtype):
        return dtype
    elif isinstance(dtype, CategoricalDtype):
        return dtype
    elif isinstance(dtype, IntervalDtype):
        return dtype
    elif isinstance(dtype, string_types):
        try:
            return DatetimeTZDtype.construct_from_string(dtype)
        except TypeError:
            pass

        if dtype.startswith('period[') or dtype.startswith('Period['):
            # do not parse string like U as period[U]
            try:
                return PeriodDtype.construct_from_string(dtype)
            except TypeError:
                pass

        elif dtype.startswith('interval[') or dtype.startswith('Interval['):
            try:
                return IntervalDtype.construct_from_string(dtype)
            except TypeError:
                pass

        try:
            return CategoricalDtype.construct_from_string(dtype)
        except TypeError:
            pass
    elif isinstance(dtype, ExtensionDtype):
        return dtype

    try:
        npdtype = np.dtype(dtype)
    except (TypeError, ValueError):
        raise

    # Any invalid dtype (such as pd.Timestamp) should raise an error.
    # np.dtype(invalid_type).kind = 0 for such objects. However, this will
    # also catch some valid dtypes such as object, np.object_ and 'object'
    # which we safeguard against by catching them earlier and returning
    # np.dtype(valid_dtype) before this condition is evaluated.
    if dtype in [object, np.object_, 'object', 'O']:
        return npdtype
    elif npdtype.kind == 'O':
        raise TypeError('dtype {0} not understood'.format(dtype))

    return npdtype
