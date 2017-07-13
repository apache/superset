"""
missing types & inference
"""
import numpy as np
from pandas._libs import lib
from pandas._libs.tslib import NaT, iNaT
from .generic import (ABCMultiIndex, ABCSeries,
                      ABCIndexClass, ABCGeneric)
from .common import (is_string_dtype, is_datetimelike,
                     is_datetimelike_v_numeric, is_float_dtype,
                     is_datetime64_dtype, is_datetime64tz_dtype,
                     is_timedelta64_dtype, is_interval_dtype,
                     is_complex_dtype, is_categorical_dtype,
                     is_string_like_dtype, is_bool_dtype,
                     is_integer_dtype, is_dtype_equal,
                     needs_i8_conversion, _ensure_object,
                     pandas_dtype,
                     is_scalar,
                     is_object_dtype,
                     is_integer,
                     _TD_DTYPE,
                     _NS_DTYPE)
from .inference import is_list_like


def isnull(obj):
    """Detect missing values (NaN in numeric arrays, None/NaN in object arrays)

    Parameters
    ----------
    arr : ndarray or object value
        Object to check for null-ness

    Returns
    -------
    isnulled : array-like of bool or bool
        Array or bool indicating whether an object is null or if an array is
        given which of the element is null.

    See also
    --------
    pandas.notnull: boolean inverse of pandas.isnull
    """
    return _isnull(obj)


def _isnull_new(obj):
    if is_scalar(obj):
        return lib.checknull(obj)
    # hack (for now) because MI registers as ndarray
    elif isinstance(obj, ABCMultiIndex):
        raise NotImplementedError("isnull is not defined for MultiIndex")
    elif isinstance(obj, (ABCSeries, np.ndarray, ABCIndexClass)):
        return _isnull_ndarraylike(obj)
    elif isinstance(obj, ABCGeneric):
        return obj._constructor(obj._data.isnull(func=isnull))
    elif isinstance(obj, list) or hasattr(obj, '__array__'):
        return _isnull_ndarraylike(np.asarray(obj))
    else:
        return obj is None


def _isnull_old(obj):
    """Detect missing values. Treat None, NaN, INF, -INF as null.

    Parameters
    ----------
    arr: ndarray or object value

    Returns
    -------
    boolean ndarray or boolean
    """
    if is_scalar(obj):
        return lib.checknull_old(obj)
    # hack (for now) because MI registers as ndarray
    elif isinstance(obj, ABCMultiIndex):
        raise NotImplementedError("isnull is not defined for MultiIndex")
    elif isinstance(obj, (ABCSeries, np.ndarray, ABCIndexClass)):
        return _isnull_ndarraylike_old(obj)
    elif isinstance(obj, ABCGeneric):
        return obj._constructor(obj._data.isnull(func=_isnull_old))
    elif isinstance(obj, list) or hasattr(obj, '__array__'):
        return _isnull_ndarraylike_old(np.asarray(obj))
    else:
        return obj is None


_isnull = _isnull_new


def _use_inf_as_null(key):
    """Option change callback for null/inf behaviour
    Choose which replacement for numpy.isnan / -numpy.isfinite is used.

    Parameters
    ----------
    flag: bool
        True means treat None, NaN, INF, -INF as null (old way),
        False means None and NaN are null, but INF, -INF are not null
        (new way).

    Notes
    -----
    This approach to setting global module values is discussed and
    approved here:

    * http://stackoverflow.com/questions/4859217/
      programmatically-creating-variables-in-python/4859312#4859312
    """
    from pandas.core.config import get_option
    flag = get_option(key)
    if flag:
        globals()['_isnull'] = _isnull_old
    else:
        globals()['_isnull'] = _isnull_new


def _isnull_ndarraylike(obj):

    values = getattr(obj, 'values', obj)
    dtype = values.dtype

    if is_string_dtype(dtype):
        if is_categorical_dtype(values):
            from pandas import Categorical
            if not isinstance(values, Categorical):
                values = values.values
            result = values.isnull()
        elif is_interval_dtype(values):
            from pandas import IntervalIndex
            result = IntervalIndex(obj).isnull()
        else:

            # Working around NumPy ticket 1542
            shape = values.shape

            if is_string_like_dtype(dtype):
                result = np.zeros(values.shape, dtype=bool)
            else:
                result = np.empty(shape, dtype=bool)
                vec = lib.isnullobj(values.ravel())
                result[...] = vec.reshape(shape)

    elif needs_i8_conversion(obj):
        # this is the NaT pattern
        result = values.view('i8') == iNaT
    else:
        result = np.isnan(values)

    # box
    if isinstance(obj, ABCSeries):
        from pandas import Series
        result = Series(result, index=obj.index, name=obj.name, copy=False)

    return result


def _isnull_ndarraylike_old(obj):
    values = getattr(obj, 'values', obj)
    dtype = values.dtype

    if is_string_dtype(dtype):
        # Working around NumPy ticket 1542
        shape = values.shape

        if is_string_like_dtype(dtype):
            result = np.zeros(values.shape, dtype=bool)
        else:
            result = np.empty(shape, dtype=bool)
            vec = lib.isnullobj_old(values.ravel())
            result[:] = vec.reshape(shape)

    elif is_datetime64_dtype(dtype):
        # this is the NaT pattern
        result = values.view('i8') == iNaT
    else:
        result = ~np.isfinite(values)

    # box
    if isinstance(obj, ABCSeries):
        from pandas import Series
        result = Series(result, index=obj.index, name=obj.name, copy=False)

    return result


def notnull(obj):
    """Replacement for numpy.isfinite / -numpy.isnan which is suitable for use
    on object arrays.

    Parameters
    ----------
    arr : ndarray or object value
        Object to check for *not*-null-ness

    Returns
    -------
    isnulled : array-like of bool or bool
        Array or bool indicating whether an object is *not* null or if an array
        is given which of the element is *not* null.

    See also
    --------
    pandas.isnull : boolean inverse of pandas.notnull
    """
    res = isnull(obj)
    if is_scalar(res):
        return not res
    return ~res


def is_null_datelike_scalar(other):
    """ test whether the object is a null datelike, e.g. Nat
    but guard against passing a non-scalar """
    if other is NaT or other is None:
        return True
    elif is_scalar(other):

        # a timedelta
        if hasattr(other, 'dtype'):
            return other.view('i8') == iNaT
        elif is_integer(other) and other == iNaT:
            return True
        return isnull(other)
    return False


def _is_na_compat(arr, fill_value=np.nan):
    """
    Parameters
    ----------
    arr: a numpy array
    fill_value: fill value, default to np.nan

    Returns
    -------
    True if we can fill using this fill_value
    """
    dtype = arr.dtype
    if isnull(fill_value):
        return not (is_bool_dtype(dtype) or
                    is_integer_dtype(dtype))
    return True


def array_equivalent(left, right, strict_nan=False):
    """
    True if two arrays, left and right, have equal non-NaN elements, and NaNs
    in corresponding locations.  False otherwise. It is assumed that left and
    right are NumPy arrays of the same dtype. The behavior of this function
    (particularly with respect to NaNs) is not defined if the dtypes are
    different.

    Parameters
    ----------
    left, right : ndarrays
    strict_nan : bool, default False
        If True, consider NaN and None to be different.

    Returns
    -------
    b : bool
        Returns True if the arrays are equivalent.

    Examples
    --------
    >>> array_equivalent(
    ...     np.array([1, 2, np.nan]),
    ...     np.array([1, 2, np.nan]))
    True
    >>> array_equivalent(
    ...     np.array([1, np.nan, 2]),
    ...     np.array([1, 2, np.nan]))
    False
    """

    left, right = np.asarray(left), np.asarray(right)

    # shape compat
    if left.shape != right.shape:
        return False

    # Object arrays can contain None, NaN and NaT.
    # string dtypes must be come to this path for NumPy 1.7.1 compat
    if is_string_dtype(left) or is_string_dtype(right):

        if not strict_nan:
            # isnull considers NaN and None to be equivalent.
            return lib.array_equivalent_object(
                _ensure_object(left.ravel()), _ensure_object(right.ravel()))

        for left_value, right_value in zip(left, right):
            if left_value is NaT and right_value is not NaT:
                return False

            elif isinstance(left_value, float) and np.isnan(left_value):
                if (not isinstance(right_value, float) or
                        not np.isnan(right_value)):
                    return False
            else:
                if left_value != right_value:
                    return False
        return True

    # NaNs can occur in float and complex arrays.
    if is_float_dtype(left) or is_complex_dtype(left):
        return ((left == right) | (isnull(left) & isnull(right))).all()

    # numpy will will not allow this type of datetimelike vs integer comparison
    elif is_datetimelike_v_numeric(left, right):
        return False

    # M8/m8
    elif needs_i8_conversion(left) and needs_i8_conversion(right):
        if not is_dtype_equal(left.dtype, right.dtype):
            return False

        left = left.view('i8')
        right = right.view('i8')

    # NaNs cannot occur otherwise.
    try:
        return np.array_equal(left, right)
    except AttributeError:
        # see gh-13388
        #
        # NumPy v1.7.1 has a bug in its array_equal
        # function that prevents it from correctly
        # comparing two arrays with complex dtypes.
        # This bug is corrected in v1.8.0, so remove
        # this try-except block as soon as we stop
        # supporting NumPy versions < 1.8.0
        if not is_dtype_equal(left.dtype, right.dtype):
            return False

        left = left.tolist()
        right = right.tolist()

        return left == right


def _infer_fill_value(val):
    """
    infer the fill value for the nan/NaT from the provided
    scalar/ndarray/list-like if we are a NaT, return the correct dtyped
    element to provide proper block construction
    """

    if not is_list_like(val):
        val = [val]
    val = np.array(val, copy=False)
    if is_datetimelike(val):
        return np.array('NaT', dtype=val.dtype)
    elif is_object_dtype(val.dtype):
        dtype = lib.infer_dtype(_ensure_object(val))
        if dtype in ['datetime', 'datetime64']:
            return np.array('NaT', dtype=_NS_DTYPE)
        elif dtype in ['timedelta', 'timedelta64']:
            return np.array('NaT', dtype=_TD_DTYPE)
    return np.nan


def _maybe_fill(arr, fill_value=np.nan):
    """
    if we have a compatiable fill_value and arr dtype, then fill
    """
    if _is_na_compat(arr, fill_value):
        arr.fill(fill_value)
    return arr


def na_value_for_dtype(dtype):
    """
    Return a dtype compat na value

    Parameters
    ----------
    dtype : string / dtype

    Returns
    -------
    np.dtype or a pandas dtype
    """
    dtype = pandas_dtype(dtype)

    if (is_datetime64_dtype(dtype) or is_datetime64tz_dtype(dtype) or
            is_timedelta64_dtype(dtype)):
        return NaT
    elif is_float_dtype(dtype):
        return np.nan
    elif is_integer_dtype(dtype):
        return 0
    elif is_bool_dtype(dtype):
        return False
    return np.nan
