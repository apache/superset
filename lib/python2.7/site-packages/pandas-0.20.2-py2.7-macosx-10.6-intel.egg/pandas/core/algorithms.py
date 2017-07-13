"""
Generic data algorithms. This module is experimental at the moment and not
intended for public consumption
"""
from __future__ import division
from warnings import warn, catch_warnings
import numpy as np

from pandas import compat, _np_version_under1p8
from pandas.core.dtypes.cast import maybe_promote
from pandas.core.dtypes.generic import (
    ABCSeries, ABCIndex,
    ABCIndexClass, ABCCategorical)
from pandas.core.dtypes.common import (
    is_unsigned_integer_dtype, is_signed_integer_dtype,
    is_integer_dtype, is_complex_dtype,
    is_object_dtype,
    is_categorical_dtype, is_sparse,
    is_period_dtype,
    is_numeric_dtype, is_float_dtype,
    is_bool_dtype, needs_i8_conversion,
    is_categorical, is_datetimetz,
    is_datetime64_any_dtype, is_datetime64tz_dtype,
    is_timedelta64_dtype, is_interval_dtype,
    is_scalar, is_list_like,
    _ensure_platform_int, _ensure_object,
    _ensure_float64, _ensure_uint64,
    _ensure_int64)
from pandas.compat.numpy import _np_version_under1p10
from pandas.core.dtypes.missing import isnull

from pandas.core import common as com
from pandas.compat import string_types
from pandas._libs import algos, lib, hashtable as htable
from pandas._libs.tslib import iNaT


# --------------- #
# dtype access    #
# --------------- #

def _ensure_data(values, dtype=None):
    """
    routine to ensure that our data is of the correct
    input dtype for lower-level routines

    This will coerce:
    - ints -> int64
    - uint -> uint64
    - bool -> uint64 (TODO this should be uint8)
    - datetimelike -> i8
    - datetime64tz -> i8 (in local tz)
    - categorical -> codes

    Parameters
    ----------
    values : array-like
    dtype : pandas_dtype, optional
        coerce to this dtype

    Returns
    -------
    (ndarray, pandas_dtype, algo dtype as a string)

    """

    # we check some simple dtypes first
    try:
        if is_bool_dtype(values) or is_bool_dtype(dtype):
            # we are actually coercing to uint64
            # until our algos suppport uint8 directly (see TODO)
            return np.asarray(values).astype('uint64'), 'bool', 'uint64'
        elif is_signed_integer_dtype(values) or is_signed_integer_dtype(dtype):
            return _ensure_int64(values), 'int64', 'int64'
        elif (is_unsigned_integer_dtype(values) or
              is_unsigned_integer_dtype(dtype)):
            return _ensure_uint64(values), 'uint64', 'uint64'
        elif is_float_dtype(values) or is_float_dtype(dtype):
            return _ensure_float64(values), 'float64', 'float64'
        elif is_object_dtype(values) and dtype is None:
            return _ensure_object(np.asarray(values)), 'object', 'object'
        elif is_complex_dtype(values) or is_complex_dtype(dtype):

            # ignore the fact that we are casting to float
            # which discards complex parts
            with catch_warnings(record=True):
                values = _ensure_float64(values)
            return values, 'float64', 'float64'

    except (TypeError, ValueError):
        # if we are trying to coerce to a dtype
        # and it is incompat this will fall thru to here
        return _ensure_object(values), 'object', 'object'

    # datetimelike
    if (needs_i8_conversion(values) or
            is_period_dtype(dtype) or
            is_datetime64_any_dtype(dtype) or
            is_timedelta64_dtype(dtype)):
        if is_period_dtype(values) or is_period_dtype(dtype):
            from pandas import PeriodIndex
            values = PeriodIndex(values)
            dtype = values.dtype
        elif is_timedelta64_dtype(values) or is_timedelta64_dtype(dtype):
            from pandas import TimedeltaIndex
            values = TimedeltaIndex(values)
            dtype = values.dtype
        else:
            # Datetime
            from pandas import DatetimeIndex
            values = DatetimeIndex(values)
            dtype = values.dtype

        return values.asi8, dtype, 'int64'

    elif is_categorical_dtype(values) or is_categorical_dtype(dtype):
        values = getattr(values, 'values', values)
        values = values.codes
        dtype = 'category'

        # we are actually coercing to int64
        # until our algos suppport int* directly (not all do)
        values = _ensure_int64(values)

        return values, dtype, 'int64'

    # we have failed, return object
    values = np.asarray(values)
    return _ensure_object(values), 'object', 'object'


def _reconstruct_data(values, dtype, original):
    """
    reverse of _ensure_data

    Parameters
    ----------
    values : ndarray
    dtype : pandas_dtype
    original : ndarray-like

    Returns
    -------
    Index for extension types, otherwise ndarray casted to dtype

    """
    from pandas import Index
    if is_categorical_dtype(dtype):
        pass
    elif is_datetime64tz_dtype(dtype) or is_period_dtype(dtype):
        values = Index(original)._shallow_copy(values, name=None)
    elif dtype is not None:
        values = values.astype(dtype)

    return values


def _ensure_arraylike(values):
    """
    ensure that we are arraylike if not already
    """
    if not isinstance(values, (np.ndarray, ABCCategorical,
                               ABCIndexClass, ABCSeries)):
        inferred = lib.infer_dtype(values)
        if inferred in ['mixed', 'string', 'unicode']:
            values = lib.list_to_object_array(values)
        else:
            values = np.asarray(values)
    return values


_hashtables = {
    'float64': (htable.Float64HashTable, htable.Float64Vector),
    'uint64': (htable.UInt64HashTable, htable.UInt64Vector),
    'int64': (htable.Int64HashTable, htable.Int64Vector),
    'string': (htable.StringHashTable, htable.ObjectVector),
    'object': (htable.PyObjectHashTable, htable.ObjectVector)
}


def _get_hashtable_algo(values):
    """
    Parameters
    ----------
    values : arraylike

    Returns
    -------
    tuples(hashtable class,
           vector class,
           values,
           dtype,
           ndtype)
    """
    values, dtype, ndtype = _ensure_data(values)

    if ndtype == 'object':

        # its cheaper to use a String Hash Table than Object
        if lib.infer_dtype(values) in ['string']:
            ndtype = 'string'
        else:
            ndtype = 'object'

    htable, table = _hashtables[ndtype]
    return (htable, table, values, dtype, ndtype)


def _get_data_algo(values, func_map):

    if is_categorical_dtype(values):
        values = values._values_for_rank()

    values, dtype, ndtype = _ensure_data(values)
    if ndtype == 'object':

        # its cheaper to use a String Hash Table than Object
        if lib.infer_dtype(values) in ['string']:
            ndtype = 'string'

    f = func_map.get(ndtype, func_map['object'])

    return f, values


# --------------- #
# top-level algos #
# --------------- #

def match(to_match, values, na_sentinel=-1):
    """
    Compute locations of to_match into values

    Parameters
    ----------
    to_match : array-like
        values to find positions of
    values : array-like
        Unique set of values
    na_sentinel : int, default -1
        Value to mark "not found"

    Examples
    --------

    Returns
    -------
    match : ndarray of integers
    """
    values = com._asarray_tuplesafe(values)
    htable, _, values, dtype, ndtype = _get_hashtable_algo(values)
    to_match, _, _ = _ensure_data(to_match, dtype)
    table = htable(min(len(to_match), 1000000))
    table.map_locations(values)
    result = table.lookup(to_match)

    if na_sentinel != -1:

        # replace but return a numpy array
        # use a Series because it handles dtype conversions properly
        from pandas import Series
        result = Series(result.ravel()).replace(-1, na_sentinel).values.\
            reshape(result.shape)

    return result


def unique(values):
    """
    Hash table-based unique. Uniques are returned in order
    of appearance. This does NOT sort.

    Significantly faster than numpy.unique. Includes NA values.

    Parameters
    ----------
    values : 1d array-like

    Returns
    -------
    unique values.
      - If the input is an Index, the return is an Index
      - If the input is a Categorical dtype, the return is a Categorical
      - If the input is a Series/ndarray, the return will be an ndarray

    Examples
    --------
    >>> pd.unique(pd.Series([2, 1, 3, 3]))
    array([2, 1, 3])

    >>> pd.unique(pd.Series([2] + [1] * 5))
    array([2, 1])

    >>> pd.unique(Series([pd.Timestamp('20160101'),
    ...                   pd.Timestamp('20160101')]))
    array(['2016-01-01T00:00:00.000000000'], dtype='datetime64[ns]')

    >>> pd.unique(pd.Series([pd.Timestamp('20160101', tz='US/Eastern'),
    ...                      pd.Timestamp('20160101', tz='US/Eastern')]))
    array([Timestamp('2016-01-01 00:00:00-0500', tz='US/Eastern')],
          dtype=object)

    >>> pd.unique(pd.Index([pd.Timestamp('20160101', tz='US/Eastern'),
    ...                     pd.Timestamp('20160101', tz='US/Eastern')]))
    DatetimeIndex(['2016-01-01 00:00:00-05:00'],
    ...           dtype='datetime64[ns, US/Eastern]', freq=None)

    >>> pd.unique(list('baabc'))
    array(['b', 'a', 'c'], dtype=object)

    An unordered Categorical will return categories in the
    order of appearance.

    >>> pd.unique(Series(pd.Categorical(list('baabc'))))
    [b, a, c]
    Categories (3, object): [b, a, c]

    >>> pd.unique(Series(pd.Categorical(list('baabc'),
    ...                                 categories=list('abc'))))
    [b, a, c]
    Categories (3, object): [b, a, c]

    An ordered Categorical preserves the category ordering.

    >>> pd.unique(Series(pd.Categorical(list('baabc'),
    ...                                 categories=list('abc'),
    ...                                 ordered=True)))
    [b, a, c]
    Categories (3, object): [a < b < c]

    An array of tuples

    >>> pd.unique([('a', 'b'), ('b', 'a'), ('a', 'c'), ('b', 'a')])
    array([('a', 'b'), ('b', 'a'), ('a', 'c')], dtype=object)

    See Also
    --------
    pandas.Index.unique
    pandas.Series.unique

    """

    values = _ensure_arraylike(values)

    # categorical is a fast-path
    # this will coerce Categorical, CategoricalIndex,
    # and category dtypes Series to same return of Category
    if is_categorical_dtype(values):
        values = getattr(values, '.values', values)
        return values.unique()

    original = values
    htable, _, values, dtype, ndtype = _get_hashtable_algo(values)

    table = htable(len(values))
    uniques = table.unique(values)
    uniques = _reconstruct_data(uniques, dtype, original)

    if isinstance(original, ABCSeries) and is_datetime64tz_dtype(dtype):
        # we are special casing datetime64tz_dtype
        # to return an object array of tz-aware Timestamps

        # TODO: it must return DatetimeArray with tz in pandas 2.0
        uniques = uniques.asobject.values

    return uniques


unique1d = unique


def isin(comps, values):
    """
    Compute the isin boolean array

    Parameters
    ----------
    comps: array-like
    values: array-like

    Returns
    -------
    boolean array same length as comps
    """

    if not is_list_like(comps):
        raise TypeError("only list-like objects are allowed to be passed"
                        " to isin(), you passed a "
                        "[{0}]".format(type(comps).__name__))
    if not is_list_like(values):
        raise TypeError("only list-like objects are allowed to be passed"
                        " to isin(), you passed a "
                        "[{0}]".format(type(values).__name__))

    if not isinstance(values, (ABCIndex, ABCSeries, np.ndarray)):
        values = lib.list_to_object_array(list(values))

    comps, dtype, _ = _ensure_data(comps)
    values, _, _ = _ensure_data(values, dtype=dtype)

    # GH11232
    # work-around for numpy < 1.8 and comparisions on py3
    # faster for larger cases to use np.in1d
    f = lambda x, y: htable.ismember_object(x, values)
    if (_np_version_under1p8 and compat.PY3) or len(comps) > 1000000:
        f = lambda x, y: np.in1d(x, y)
    elif is_integer_dtype(comps):
        try:
            values = values.astype('int64', copy=False)
            comps = comps.astype('int64', copy=False)
            f = lambda x, y: htable.ismember_int64(x, y)
        except (TypeError, ValueError):
            values = values.astype(object)
            comps = comps.astype(object)

    elif is_float_dtype(comps):
        try:
            values = values.astype('float64', copy=False)
            comps = comps.astype('float64', copy=False)
            checknull = isnull(values).any()
            f = lambda x, y: htable.ismember_float64(x, y, checknull)
        except (TypeError, ValueError):
            values = values.astype(object)
            comps = comps.astype(object)

    return f(comps, values)


def safe_sort(values, labels=None, na_sentinel=-1, assume_unique=False):
    """
    Sort ``values`` and reorder corresponding ``labels``.
    ``values`` should be unique if ``labels`` is not None.
    Safe for use with mixed types (int, str), orders ints before strs.

    .. versionadded:: 0.19.0

    Parameters
    ----------
    values : list-like
        Sequence; must be unique if ``labels`` is not None.
    labels : list_like
        Indices to ``values``. All out of bound indices are treated as
        "not found" and will be masked with ``na_sentinel``.
    na_sentinel : int, default -1
        Value in ``labels`` to mark "not found".
        Ignored when ``labels`` is None.
    assume_unique : bool, default False
        When True, ``values`` are assumed to be unique, which can speed up
        the calculation. Ignored when ``labels`` is None.

    Returns
    -------
    ordered : ndarray
        Sorted ``values``
    new_labels : ndarray
        Reordered ``labels``; returned when ``labels`` is not None.

    Raises
    ------
    TypeError
        * If ``values`` is not list-like or if ``labels`` is neither None
        nor list-like
        * If ``values`` cannot be sorted
    ValueError
        * If ``labels`` is not None and ``values`` contain duplicates.
    """
    if not is_list_like(values):
        raise TypeError("Only list-like objects are allowed to be passed to"
                        "safe_sort as values")
    values = np.asarray(values)

    def sort_mixed(values):
        # order ints before strings, safe in py3
        str_pos = np.array([isinstance(x, string_types) for x in values],
                           dtype=bool)
        nums = np.sort(values[~str_pos])
        strs = np.sort(values[str_pos])
        return _ensure_object(np.concatenate([nums, strs]))

    sorter = None
    if compat.PY3 and lib.infer_dtype(values) == 'mixed-integer':
        # unorderable in py3 if mixed str/int
        ordered = sort_mixed(values)
    else:
        try:
            sorter = values.argsort()
            ordered = values.take(sorter)
        except TypeError:
            # try this anyway
            ordered = sort_mixed(values)

    # labels:

    if labels is None:
        return ordered

    if not is_list_like(labels):
        raise TypeError("Only list-like objects or None are allowed to be"
                        "passed to safe_sort as labels")
    labels = _ensure_platform_int(np.asarray(labels))

    from pandas import Index
    if not assume_unique and not Index(values).is_unique:
        raise ValueError("values should be unique if labels is not None")

    if sorter is None:
        # mixed types
        (hash_klass, _), values = _get_data_algo(values, _hashtables)
        t = hash_klass(len(values))
        t.map_locations(values)
        sorter = _ensure_platform_int(t.lookup(ordered))

    reverse_indexer = np.empty(len(sorter), dtype=np.int_)
    reverse_indexer.put(sorter, np.arange(len(sorter)))

    mask = (labels < -len(values)) | (labels >= len(values)) | \
        (labels == na_sentinel)

    # (Out of bound indices will be masked with `na_sentinel` next, so we may
    # deal with them here without performance loss using `mode='wrap'`.)
    new_labels = reverse_indexer.take(labels, mode='wrap')
    np.putmask(new_labels, mask, na_sentinel)

    return ordered, _ensure_platform_int(new_labels)


def factorize(values, sort=False, order=None, na_sentinel=-1, size_hint=None):
    """
    Encode input values as an enumerated type or categorical variable

    Parameters
    ----------
    values : ndarray (1-d)
        Sequence
    sort : boolean, default False
        Sort by values
    na_sentinel : int, default -1
        Value to mark "not found"
    size_hint : hint to the hashtable sizer

    Returns
    -------
    labels : the indexer to the original array
    uniques : ndarray (1-d) or Index
        the unique values. Index is returned when passed values is Index or
        Series

    note: an array of Periods will ignore sort as it returns an always sorted
    PeriodIndex
    """

    values = _ensure_arraylike(values)
    original = values
    values, dtype, _ = _ensure_data(values)
    (hash_klass, vec_klass), values = _get_data_algo(values, _hashtables)

    table = hash_klass(size_hint or len(values))
    uniques = vec_klass()
    check_nulls = not is_integer_dtype(original)
    labels = table.get_labels(values, uniques, 0, na_sentinel, check_nulls)

    labels = _ensure_platform_int(labels)
    uniques = uniques.to_array()

    if sort and len(uniques) > 0:
        uniques, labels = safe_sort(uniques, labels, na_sentinel=na_sentinel,
                                    assume_unique=True)

    uniques = _reconstruct_data(uniques, dtype, original)

    # return original tenor
    if isinstance(original, ABCIndexClass):
        uniques = original._shallow_copy(uniques, name=None)
    elif isinstance(original, ABCSeries):
        from pandas import Index
        uniques = Index(uniques)

    return labels, uniques


def value_counts(values, sort=True, ascending=False, normalize=False,
                 bins=None, dropna=True):
    """
    Compute a histogram of the counts of non-null values.

    Parameters
    ----------
    values : ndarray (1-d)
    sort : boolean, default True
        Sort by values
    ascending : boolean, default False
        Sort in ascending order
    normalize: boolean, default False
        If True then compute a relative histogram
    bins : integer, optional
        Rather than count values, group them into half-open bins,
        convenience for pd.cut, only works with numeric data
    dropna : boolean, default True
        Don't include counts of NaN

    Returns
    -------
    value_counts : Series

    """
    from pandas.core.series import Series, Index
    name = getattr(values, 'name', None)

    if bins is not None:
        try:
            from pandas.core.reshape.tile import cut
            values = Series(values)
            ii = cut(values, bins, include_lowest=True)
        except TypeError:
            raise TypeError("bins argument only works with numeric data.")

        # count, remove nulls (from the index), and but the bins
        result = ii.value_counts(dropna=dropna)
        result = result[result.index.notnull()]
        result.index = result.index.astype('interval')
        result = result.sort_index()

        # if we are dropna and we have NO values
        if dropna and (result.values == 0).all():
            result = result.iloc[0:0]

        # normalizing is by len of all (regardless of dropna)
        counts = np.array([len(ii)])

    else:

        if is_categorical_dtype(values) or is_sparse(values):

            # handle Categorical and sparse,
            result = Series(values).values.value_counts(dropna=dropna)
            result.name = name
            counts = result.values

        else:
            keys, counts = _value_counts_arraylike(values, dropna)

            if not isinstance(keys, Index):
                keys = Index(keys)
            result = Series(counts, index=keys, name=name)

    if sort:
        result = result.sort_values(ascending=ascending)

    if normalize:
        result = result / float(counts.sum())

    return result


def _value_counts_arraylike(values, dropna):
    """
    Parameters
    ----------
    values : arraylike
    dropna : boolean

    Returns
    -------
    (uniques, counts)

    """
    values = _ensure_arraylike(values)
    original = values
    values, dtype, ndtype = _ensure_data(values)

    if needs_i8_conversion(dtype):
        # i8

        keys, counts = htable.value_count_int64(values, dropna)

        if dropna:
            msk = keys != iNaT
            keys, counts = keys[msk], counts[msk]

    else:
        # ndarray like

        # TODO: handle uint8
        f = getattr(htable, "value_count_{dtype}".format(dtype=ndtype))
        keys, counts = f(values, dropna)

        mask = isnull(values)
        if not dropna and mask.any():
            if not isnull(keys).any():
                keys = np.insert(keys, 0, np.NaN)
                counts = np.insert(counts, 0, mask.sum())

    keys = _reconstruct_data(keys, original.dtype, original)

    return keys, counts


def duplicated(values, keep='first'):
    """
    Return boolean ndarray denoting duplicate values.

    .. versionadded:: 0.19.0

    Parameters
    ----------
    values : ndarray-like
        Array over which to check for duplicate values.
    keep : {'first', 'last', False}, default 'first'
        - ``first`` : Mark duplicates as ``True`` except for the first
          occurrence.
        - ``last`` : Mark duplicates as ``True`` except for the last
          occurrence.
        - False : Mark all duplicates as ``True``.

    Returns
    -------
    duplicated : ndarray
    """

    values, dtype, ndtype = _ensure_data(values)
    f = getattr(htable, "duplicated_{dtype}".format(dtype=ndtype))
    return f(values, keep=keep)


def mode(values):
    """
    Returns the mode(s) of an array.

    Parameters
    ----------
    values : array-like
        Array over which to check for duplicate values.

    Returns
    -------
    mode : Series
    """
    from pandas import Series

    values = _ensure_arraylike(values)
    original = values

    # categorical is a fast-path
    if is_categorical_dtype(values):

        if isinstance(values, Series):
            return Series(values.values.mode(), name=values.name)
        return values.mode()

    values, dtype, ndtype = _ensure_data(values)

    # TODO: this should support float64
    if ndtype not in ['int64', 'uint64', 'object']:
        ndtype = 'object'
        values = _ensure_object(values)

    f = getattr(htable, "mode_{dtype}".format(dtype=ndtype))
    result = f(values)
    try:
        result = np.sort(result)
    except TypeError as e:
        warn("Unable to sort modes: %s" % e)

    result = _reconstruct_data(result, original.dtype, original)
    return Series(result)


def rank(values, axis=0, method='average', na_option='keep',
         ascending=True, pct=False):
    """
    Rank the values along a given axis.

    Parameters
    ----------
    values : array-like
        Array whose values will be ranked. The number of dimensions in this
        array must not exceed 2.
    axis : int, default 0
        Axis over which to perform rankings.
    method : {'average', 'min', 'max', 'first', 'dense'}, default 'average'
        The method by which tiebreaks are broken during the ranking.
    na_option : {'keep', 'top'}, default 'keep'
        The method by which NaNs are placed in the ranking.
        - ``keep``: rank each NaN value with a NaN ranking
        - ``top``: replace each NaN with either +/- inf so that they
                   there are ranked at the top
    ascending : boolean, default True
        Whether or not the elements should be ranked in ascending order.
    pct : boolean, default False
        Whether or not to the display the returned rankings in integer form
        (e.g. 1, 2, 3) or in percentile form (e.g. 0.333..., 0.666..., 1).
    """
    if values.ndim == 1:
        f, values = _get_data_algo(values, _rank1d_functions)
        ranks = f(values, ties_method=method, ascending=ascending,
                  na_option=na_option, pct=pct)
    elif values.ndim == 2:
        f, values = _get_data_algo(values, _rank2d_functions)
        ranks = f(values, axis=axis, ties_method=method,
                  ascending=ascending, na_option=na_option, pct=pct)
    else:
        raise TypeError("Array with ndim > 2 are not supported.")

    return ranks


def checked_add_with_arr(arr, b, arr_mask=None, b_mask=None):
    """
    Perform array addition that checks for underflow and overflow.

    Performs the addition of an int64 array and an int64 integer (or array)
    but checks that they do not result in overflow first. For elements that
    are indicated to be NaN, whether or not there is overflow for that element
    is automatically ignored.

    Parameters
    ----------
    arr : array addend.
    b : array or scalar addend.
    arr_mask : boolean array or None
        array indicating which elements to exclude from checking
    b_mask : boolean array or boolean or None
        array or scalar indicating which element(s) to exclude from checking

    Returns
    -------
    sum : An array for elements x + b for each element x in arr if b is
          a scalar or an array for elements x + y for each element pair
          (x, y) in (arr, b).

    Raises
    ------
    OverflowError if any x + y exceeds the maximum or minimum int64 value.
    """
    def _broadcast(arr_or_scalar, shape):
        """
        Helper function to broadcast arrays / scalars to the desired shape.
        """
        if _np_version_under1p10:
            if lib.isscalar(arr_or_scalar):
                out = np.empty(shape)
                out.fill(arr_or_scalar)
            else:
                out = arr_or_scalar
        else:
            out = np.broadcast_to(arr_or_scalar, shape)
        return out

    # For performance reasons, we broadcast 'b' to the new array 'b2'
    # so that it has the same size as 'arr'.
    b2 = _broadcast(b, arr.shape)
    if b_mask is not None:
        # We do the same broadcasting for b_mask as well.
        b2_mask = _broadcast(b_mask, arr.shape)
    else:
        b2_mask = None

    # For elements that are NaN, regardless of their value, we should
    # ignore whether they overflow or not when doing the checked add.
    if arr_mask is not None and b2_mask is not None:
        not_nan = np.logical_not(arr_mask | b2_mask)
    elif arr_mask is not None:
        not_nan = np.logical_not(arr_mask)
    elif b_mask is not None:
        not_nan = np.logical_not(b2_mask)
    else:
        not_nan = np.empty(arr.shape, dtype=bool)
        not_nan.fill(True)

    # gh-14324: For each element in 'arr' and its corresponding element
    # in 'b2', we check the sign of the element in 'b2'. If it is positive,
    # we then check whether its sum with the element in 'arr' exceeds
    # np.iinfo(np.int64).max. If so, we have an overflow error. If it
    # it is negative, we then check whether its sum with the element in
    # 'arr' exceeds np.iinfo(np.int64).min. If so, we have an overflow
    # error as well.
    mask1 = b2 > 0
    mask2 = b2 < 0

    if not mask1.any():
        to_raise = ((np.iinfo(np.int64).min - b2 > arr) & not_nan).any()
    elif not mask2.any():
        to_raise = ((np.iinfo(np.int64).max - b2 < arr) & not_nan).any()
    else:
        to_raise = (((np.iinfo(np.int64).max -
                      b2[mask1] < arr[mask1]) & not_nan[mask1]).any() or
                    ((np.iinfo(np.int64).min -
                      b2[mask2] > arr[mask2]) & not_nan[mask2]).any())

    if to_raise:
        raise OverflowError("Overflow in int64 addition")
    return arr + b


_rank1d_functions = {
    'float64': algos.rank_1d_float64,
    'int64': algos.rank_1d_int64,
    'uint64': algos.rank_1d_uint64,
    'object': algos.rank_1d_object
}

_rank2d_functions = {
    'float64': algos.rank_2d_float64,
    'int64': algos.rank_2d_int64,
    'uint64': algos.rank_2d_uint64,
    'object': algos.rank_2d_object
}


def quantile(x, q, interpolation_method='fraction'):
    """
    Compute sample quantile or quantiles of the input array. For example, q=0.5
    computes the median.

    The `interpolation_method` parameter supports three values, namely
    `fraction` (default), `lower` and `higher`. Interpolation is done only,
    if the desired quantile lies between two data points `i` and `j`. For
    `fraction`, the result is an interpolated value between `i` and `j`;
    for `lower`, the result is `i`, for `higher` the result is `j`.

    Parameters
    ----------
    x : ndarray
        Values from which to extract score.
    q : scalar or array
        Percentile at which to extract score.
    interpolation_method : {'fraction', 'lower', 'higher'}, optional
        This optional parameter specifies the interpolation method to use,
        when the desired quantile lies between two data points `i` and `j`:

        - fraction: `i + (j - i)*fraction`, where `fraction` is the
                    fractional part of the index surrounded by `i` and `j`.
        -lower: `i`.
        - higher: `j`.

    Returns
    -------
    score : float
        Score at percentile.

    Examples
    --------
    >>> from scipy import stats
    >>> a = np.arange(100)
    >>> stats.scoreatpercentile(a, 50)
    49.5

    """
    x = np.asarray(x)
    mask = isnull(x)

    x = x[~mask]

    values = np.sort(x)

    def _interpolate(a, b, fraction):
        """Returns the point at the given fraction between a and b, where
        'fraction' must be between 0 and 1.
        """
        return a + (b - a) * fraction

    def _get_score(at):
        if len(values) == 0:
            return np.nan

        idx = at * (len(values) - 1)
        if idx % 1 == 0:
            score = values[int(idx)]
        else:
            if interpolation_method == 'fraction':
                score = _interpolate(values[int(idx)], values[int(idx) + 1],
                                     idx % 1)
            elif interpolation_method == 'lower':
                score = values[np.floor(idx)]
            elif interpolation_method == 'higher':
                score = values[np.ceil(idx)]
            else:
                raise ValueError("interpolation_method can only be 'fraction' "
                                 ", 'lower' or 'higher'")

        return score

    if is_scalar(q):
        return _get_score(q)
    else:
        q = np.asarray(q, np.float64)
        return algos.arrmap_float64(q, _get_score)


# --------------- #
# select n        #
# --------------- #

class SelectN(object):

    def __init__(self, obj, n, keep):
        self.obj = obj
        self.n = n
        self.keep = keep

        if self.keep not in ('first', 'last'):
            raise ValueError('keep must be either "first", "last"')

    def nlargest(self):
        return self.compute('nlargest')

    def nsmallest(self):
        return self.compute('nsmallest')

    @staticmethod
    def is_valid_dtype_n_method(dtype):
        """
        Helper function to determine if dtype is valid for
        nsmallest/nlargest methods
        """
        return ((is_numeric_dtype(dtype) and not is_complex_dtype(dtype)) or
                needs_i8_conversion(dtype))


class SelectNSeries(SelectN):
    """
    Implement n largest/smallest for Series

    Parameters
    ----------
    obj : Series
    n : int
    keep : {'first', 'last'}, default 'first'

    Returns
    -------
    nordered : Series
    """

    def compute(self, method):

        n = self.n
        dtype = self.obj.dtype
        if not self.is_valid_dtype_n_method(dtype):
            raise TypeError("Cannot use method '{method}' with "
                            "dtype {dtype}".format(method=method,
                                                   dtype=dtype))

        if n <= 0:
            return self.obj[[]]

        dropped = self.obj.dropna()

        # slow method
        if n >= len(self.obj):

            reverse_it = (self.keep == 'last' or method == 'nlargest')
            ascending = method == 'nsmallest'
            slc = np.s_[::-1] if reverse_it else np.s_[:]
            return dropped[slc].sort_values(ascending=ascending).head(n)

        # fast method
        arr, _, _ = _ensure_data(dropped.values)
        if method == 'nlargest':
            arr = -arr

        if self.keep == 'last':
            arr = arr[::-1]

        narr = len(arr)
        n = min(n, narr)

        kth_val = algos.kth_smallest(arr.copy(), n - 1)
        ns, = np.nonzero(arr <= kth_val)
        inds = ns[arr[ns].argsort(kind='mergesort')][:n]
        if self.keep == 'last':
            # reverse indices
            inds = narr - 1 - inds

        return dropped.iloc[inds]


class SelectNFrame(SelectN):
    """
    Implement n largest/smallest for DataFrame

    Parameters
    ----------
    obj : DataFrame
    n : int
    keep : {'first', 'last'}, default 'first'
    columns : list or str

    Returns
    -------
    nordered : DataFrame
    """

    def __init__(self, obj, n, keep, columns):
        super(SelectNFrame, self).__init__(obj, n, keep)
        if not is_list_like(columns):
            columns = [columns]
        columns = list(columns)
        self.columns = columns

    def compute(self, method):

        from pandas import Int64Index
        n = self.n
        frame = self.obj
        columns = self.columns

        for column in columns:
            dtype = frame[column].dtype
            if not self.is_valid_dtype_n_method(dtype):
                raise TypeError((
                    "Column {column!r} has dtype {dtype}, cannot use method "
                    "{method!r} with this dtype"
                ).format(column=column, dtype=dtype, method=method))

        def get_indexer(current_indexer, other_indexer):
            """Helper function to concat `current_indexer` and `other_indexer`
            depending on `method`
            """
            if method == 'nsmallest':
                return current_indexer.append(other_indexer)
            else:
                return other_indexer.append(current_indexer)

        # Below we save and reset the index in case index contains duplicates
        original_index = frame.index
        cur_frame = frame = frame.reset_index(drop=True)
        cur_n = n
        indexer = Int64Index([])

        for i, column in enumerate(columns):

            # For each column we apply method to cur_frame[column].
            # If it is the last column in columns, or if the values
            # returned are unique in frame[column] we save this index
            # and break
            # Otherwise we must save the index of the non duplicated values
            # and set the next cur_frame to cur_frame filtered on all
            # duplcicated values (#GH15297)
            series = cur_frame[column]
            values = getattr(series, method)(cur_n, keep=self.keep)
            is_last_column = len(columns) - 1 == i
            if is_last_column or values.nunique() == series.isin(values).sum():

                # Last column in columns or values are unique in
                # series => values
                # is all that matters
                indexer = get_indexer(indexer, values.index)
                break

            duplicated_filter = series.duplicated(keep=False)
            duplicated = values[duplicated_filter]
            non_duplicated = values[~duplicated_filter]
            indexer = get_indexer(indexer, non_duplicated.index)

            # Must set cur frame to include all duplicated values
            # to consider for the next column, we also can reduce
            # cur_n by the current length of the indexer
            cur_frame = cur_frame[series.isin(duplicated)]
            cur_n = n - len(indexer)

        frame = frame.take(indexer)

        # Restore the index on frame
        frame.index = original_index.take(indexer)
        return frame


# ------- ## ---- #
# take #
# ---- #


def _view_wrapper(f, arr_dtype=None, out_dtype=None, fill_wrap=None):
    def wrapper(arr, indexer, out, fill_value=np.nan):
        if arr_dtype is not None:
            arr = arr.view(arr_dtype)
        if out_dtype is not None:
            out = out.view(out_dtype)
        if fill_wrap is not None:
            fill_value = fill_wrap(fill_value)
        f(arr, indexer, out, fill_value=fill_value)

    return wrapper


def _convert_wrapper(f, conv_dtype):
    def wrapper(arr, indexer, out, fill_value=np.nan):
        arr = arr.astype(conv_dtype)
        f(arr, indexer, out, fill_value=fill_value)

    return wrapper


def _take_2d_multi_object(arr, indexer, out, fill_value, mask_info):
    # this is not ideal, performance-wise, but it's better than raising
    # an exception (best to optimize in Cython to avoid getting here)
    row_idx, col_idx = indexer
    if mask_info is not None:
        (row_mask, col_mask), (row_needs, col_needs) = mask_info
    else:
        row_mask = row_idx == -1
        col_mask = col_idx == -1
        row_needs = row_mask.any()
        col_needs = col_mask.any()
    if fill_value is not None:
        if row_needs:
            out[row_mask, :] = fill_value
        if col_needs:
            out[:, col_mask] = fill_value
    for i in range(len(row_idx)):
        u_ = row_idx[i]
        for j in range(len(col_idx)):
            v = col_idx[j]
            out[i, j] = arr[u_, v]


def _take_nd_object(arr, indexer, out, axis, fill_value, mask_info):
    if mask_info is not None:
        mask, needs_masking = mask_info
    else:
        mask = indexer == -1
        needs_masking = mask.any()
    if arr.dtype != out.dtype:
        arr = arr.astype(out.dtype)
    if arr.shape[axis] > 0:
        arr.take(_ensure_platform_int(indexer), axis=axis, out=out)
    if needs_masking:
        outindexer = [slice(None)] * arr.ndim
        outindexer[axis] = mask
        out[tuple(outindexer)] = fill_value


_take_1d_dict = {
    ('int8', 'int8'): algos.take_1d_int8_int8,
    ('int8', 'int32'): algos.take_1d_int8_int32,
    ('int8', 'int64'): algos.take_1d_int8_int64,
    ('int8', 'float64'): algos.take_1d_int8_float64,
    ('int16', 'int16'): algos.take_1d_int16_int16,
    ('int16', 'int32'): algos.take_1d_int16_int32,
    ('int16', 'int64'): algos.take_1d_int16_int64,
    ('int16', 'float64'): algos.take_1d_int16_float64,
    ('int32', 'int32'): algos.take_1d_int32_int32,
    ('int32', 'int64'): algos.take_1d_int32_int64,
    ('int32', 'float64'): algos.take_1d_int32_float64,
    ('int64', 'int64'): algos.take_1d_int64_int64,
    ('int64', 'float64'): algos.take_1d_int64_float64,
    ('float32', 'float32'): algos.take_1d_float32_float32,
    ('float32', 'float64'): algos.take_1d_float32_float64,
    ('float64', 'float64'): algos.take_1d_float64_float64,
    ('object', 'object'): algos.take_1d_object_object,
    ('bool', 'bool'): _view_wrapper(algos.take_1d_bool_bool, np.uint8,
                                    np.uint8),
    ('bool', 'object'): _view_wrapper(algos.take_1d_bool_object, np.uint8,
                                      None),
    ('datetime64[ns]', 'datetime64[ns]'): _view_wrapper(
        algos.take_1d_int64_int64, np.int64, np.int64, np.int64)
}

_take_2d_axis0_dict = {
    ('int8', 'int8'): algos.take_2d_axis0_int8_int8,
    ('int8', 'int32'): algos.take_2d_axis0_int8_int32,
    ('int8', 'int64'): algos.take_2d_axis0_int8_int64,
    ('int8', 'float64'): algos.take_2d_axis0_int8_float64,
    ('int16', 'int16'): algos.take_2d_axis0_int16_int16,
    ('int16', 'int32'): algos.take_2d_axis0_int16_int32,
    ('int16', 'int64'): algos.take_2d_axis0_int16_int64,
    ('int16', 'float64'): algos.take_2d_axis0_int16_float64,
    ('int32', 'int32'): algos.take_2d_axis0_int32_int32,
    ('int32', 'int64'): algos.take_2d_axis0_int32_int64,
    ('int32', 'float64'): algos.take_2d_axis0_int32_float64,
    ('int64', 'int64'): algos.take_2d_axis0_int64_int64,
    ('int64', 'float64'): algos.take_2d_axis0_int64_float64,
    ('float32', 'float32'): algos.take_2d_axis0_float32_float32,
    ('float32', 'float64'): algos.take_2d_axis0_float32_float64,
    ('float64', 'float64'): algos.take_2d_axis0_float64_float64,
    ('object', 'object'): algos.take_2d_axis0_object_object,
    ('bool', 'bool'): _view_wrapper(algos.take_2d_axis0_bool_bool, np.uint8,
                                    np.uint8),
    ('bool', 'object'): _view_wrapper(algos.take_2d_axis0_bool_object,
                                      np.uint8, None),
    ('datetime64[ns]', 'datetime64[ns]'):
    _view_wrapper(algos.take_2d_axis0_int64_int64, np.int64, np.int64,
                  fill_wrap=np.int64)
}

_take_2d_axis1_dict = {
    ('int8', 'int8'): algos.take_2d_axis1_int8_int8,
    ('int8', 'int32'): algos.take_2d_axis1_int8_int32,
    ('int8', 'int64'): algos.take_2d_axis1_int8_int64,
    ('int8', 'float64'): algos.take_2d_axis1_int8_float64,
    ('int16', 'int16'): algos.take_2d_axis1_int16_int16,
    ('int16', 'int32'): algos.take_2d_axis1_int16_int32,
    ('int16', 'int64'): algos.take_2d_axis1_int16_int64,
    ('int16', 'float64'): algos.take_2d_axis1_int16_float64,
    ('int32', 'int32'): algos.take_2d_axis1_int32_int32,
    ('int32', 'int64'): algos.take_2d_axis1_int32_int64,
    ('int32', 'float64'): algos.take_2d_axis1_int32_float64,
    ('int64', 'int64'): algos.take_2d_axis1_int64_int64,
    ('int64', 'float64'): algos.take_2d_axis1_int64_float64,
    ('float32', 'float32'): algos.take_2d_axis1_float32_float32,
    ('float32', 'float64'): algos.take_2d_axis1_float32_float64,
    ('float64', 'float64'): algos.take_2d_axis1_float64_float64,
    ('object', 'object'): algos.take_2d_axis1_object_object,
    ('bool', 'bool'): _view_wrapper(algos.take_2d_axis1_bool_bool, np.uint8,
                                    np.uint8),
    ('bool', 'object'): _view_wrapper(algos.take_2d_axis1_bool_object,
                                      np.uint8, None),
    ('datetime64[ns]', 'datetime64[ns]'):
    _view_wrapper(algos.take_2d_axis1_int64_int64, np.int64, np.int64,
                  fill_wrap=np.int64)
}

_take_2d_multi_dict = {
    ('int8', 'int8'): algos.take_2d_multi_int8_int8,
    ('int8', 'int32'): algos.take_2d_multi_int8_int32,
    ('int8', 'int64'): algos.take_2d_multi_int8_int64,
    ('int8', 'float64'): algos.take_2d_multi_int8_float64,
    ('int16', 'int16'): algos.take_2d_multi_int16_int16,
    ('int16', 'int32'): algos.take_2d_multi_int16_int32,
    ('int16', 'int64'): algos.take_2d_multi_int16_int64,
    ('int16', 'float64'): algos.take_2d_multi_int16_float64,
    ('int32', 'int32'): algos.take_2d_multi_int32_int32,
    ('int32', 'int64'): algos.take_2d_multi_int32_int64,
    ('int32', 'float64'): algos.take_2d_multi_int32_float64,
    ('int64', 'int64'): algos.take_2d_multi_int64_int64,
    ('int64', 'float64'): algos.take_2d_multi_int64_float64,
    ('float32', 'float32'): algos.take_2d_multi_float32_float32,
    ('float32', 'float64'): algos.take_2d_multi_float32_float64,
    ('float64', 'float64'): algos.take_2d_multi_float64_float64,
    ('object', 'object'): algos.take_2d_multi_object_object,
    ('bool', 'bool'): _view_wrapper(algos.take_2d_multi_bool_bool, np.uint8,
                                    np.uint8),
    ('bool', 'object'): _view_wrapper(algos.take_2d_multi_bool_object,
                                      np.uint8, None),
    ('datetime64[ns]', 'datetime64[ns]'):
    _view_wrapper(algos.take_2d_multi_int64_int64, np.int64, np.int64,
                  fill_wrap=np.int64)
}


def _get_take_nd_function(ndim, arr_dtype, out_dtype, axis=0, mask_info=None):
    if ndim <= 2:
        tup = (arr_dtype.name, out_dtype.name)
        if ndim == 1:
            func = _take_1d_dict.get(tup, None)
        elif ndim == 2:
            if axis == 0:
                func = _take_2d_axis0_dict.get(tup, None)
            else:
                func = _take_2d_axis1_dict.get(tup, None)
        if func is not None:
            return func

        tup = (out_dtype.name, out_dtype.name)
        if ndim == 1:
            func = _take_1d_dict.get(tup, None)
        elif ndim == 2:
            if axis == 0:
                func = _take_2d_axis0_dict.get(tup, None)
            else:
                func = _take_2d_axis1_dict.get(tup, None)
        if func is not None:
            func = _convert_wrapper(func, out_dtype)
            return func

    def func(arr, indexer, out, fill_value=np.nan):
        indexer = _ensure_int64(indexer)
        _take_nd_object(arr, indexer, out, axis=axis, fill_value=fill_value,
                        mask_info=mask_info)

    return func


def take_nd(arr, indexer, axis=0, out=None, fill_value=np.nan, mask_info=None,
            allow_fill=True):
    """
    Specialized Cython take which sets NaN values in one pass

    Parameters
    ----------
    arr : ndarray
        Input array
    indexer : ndarray
        1-D array of indices to take, subarrays corresponding to -1 value
        indicies are filed with fill_value
    axis : int, default 0
        Axis to take from
    out : ndarray or None, default None
        Optional output array, must be appropriate type to hold input and
        fill_value together, if indexer has any -1 value entries; call
        _maybe_promote to determine this type for any fill_value
    fill_value : any, default np.nan
        Fill value to replace -1 values with
    mask_info : tuple of (ndarray, boolean)
        If provided, value should correspond to:
            (indexer != -1, (indexer != -1).any())
        If not provided, it will be computed internally if necessary
    allow_fill : boolean, default True
        If False, indexer is assumed to contain no -1 values so no filling
        will be done.  This short-circuits computation of a mask.  Result is
        undefined if allow_fill == False and -1 is present in indexer.
    """

    # dispatch to internal type takes
    if is_categorical(arr):
        return arr.take_nd(indexer, fill_value=fill_value,
                           allow_fill=allow_fill)
    elif is_datetimetz(arr):
        return arr.take(indexer, fill_value=fill_value, allow_fill=allow_fill)
    elif is_interval_dtype(arr):
        return arr.take(indexer, fill_value=fill_value, allow_fill=allow_fill)

    if indexer is None:
        indexer = np.arange(arr.shape[axis], dtype=np.int64)
        dtype, fill_value = arr.dtype, arr.dtype.type()
    else:
        indexer = _ensure_int64(indexer, copy=False)
        if not allow_fill:
            dtype, fill_value = arr.dtype, arr.dtype.type()
            mask_info = None, False
        else:
            # check for promotion based on types only (do this first because
            # it's faster than computing a mask)
            dtype, fill_value = maybe_promote(arr.dtype, fill_value)
            if dtype != arr.dtype and (out is None or out.dtype != dtype):
                # check if promotion is actually required based on indexer
                if mask_info is not None:
                    mask, needs_masking = mask_info
                else:
                    mask = indexer == -1
                    needs_masking = mask.any()
                    mask_info = mask, needs_masking
                if needs_masking:
                    if out is not None and out.dtype != dtype:
                        raise TypeError('Incompatible type for fill_value')
                else:
                    # if not, then depromote, set fill_value to dummy
                    # (it won't be used but we don't want the cython code
                    # to crash when trying to cast it to dtype)
                    dtype, fill_value = arr.dtype, arr.dtype.type()

    flip_order = False
    if arr.ndim == 2:
        if arr.flags.f_contiguous:
            flip_order = True

    if flip_order:
        arr = arr.T
        axis = arr.ndim - axis - 1
        if out is not None:
            out = out.T

    # at this point, it's guaranteed that dtype can hold both the arr values
    # and the fill_value
    if out is None:
        out_shape = list(arr.shape)
        out_shape[axis] = len(indexer)
        out_shape = tuple(out_shape)
        if arr.flags.f_contiguous and axis == arr.ndim - 1:
            # minor tweak that can make an order-of-magnitude difference
            # for dataframes initialized directly from 2-d ndarrays
            # (s.t. df.values is c-contiguous and df._data.blocks[0] is its
            # f-contiguous transpose)
            out = np.empty(out_shape, dtype=dtype, order='F')
        else:
            out = np.empty(out_shape, dtype=dtype)

    func = _get_take_nd_function(arr.ndim, arr.dtype, out.dtype, axis=axis,
                                 mask_info=mask_info)
    func(arr, indexer, out, fill_value)

    if flip_order:
        out = out.T
    return out


take_1d = take_nd


def take_2d_multi(arr, indexer, out=None, fill_value=np.nan, mask_info=None,
                  allow_fill=True):
    """
    Specialized Cython take which sets NaN values in one pass
    """
    if indexer is None or (indexer[0] is None and indexer[1] is None):
        row_idx = np.arange(arr.shape[0], dtype=np.int64)
        col_idx = np.arange(arr.shape[1], dtype=np.int64)
        indexer = row_idx, col_idx
        dtype, fill_value = arr.dtype, arr.dtype.type()
    else:
        row_idx, col_idx = indexer
        if row_idx is None:
            row_idx = np.arange(arr.shape[0], dtype=np.int64)
        else:
            row_idx = _ensure_int64(row_idx)
        if col_idx is None:
            col_idx = np.arange(arr.shape[1], dtype=np.int64)
        else:
            col_idx = _ensure_int64(col_idx)
        indexer = row_idx, col_idx
        if not allow_fill:
            dtype, fill_value = arr.dtype, arr.dtype.type()
            mask_info = None, False
        else:
            # check for promotion based on types only (do this first because
            # it's faster than computing a mask)
            dtype, fill_value = maybe_promote(arr.dtype, fill_value)
            if dtype != arr.dtype and (out is None or out.dtype != dtype):
                # check if promotion is actually required based on indexer
                if mask_info is not None:
                    (row_mask, col_mask), (row_needs, col_needs) = mask_info
                else:
                    row_mask = row_idx == -1
                    col_mask = col_idx == -1
                    row_needs = row_mask.any()
                    col_needs = col_mask.any()
                    mask_info = (row_mask, col_mask), (row_needs, col_needs)
                if row_needs or col_needs:
                    if out is not None and out.dtype != dtype:
                        raise TypeError('Incompatible type for fill_value')
                else:
                    # if not, then depromote, set fill_value to dummy
                    # (it won't be used but we don't want the cython code
                    # to crash when trying to cast it to dtype)
                    dtype, fill_value = arr.dtype, arr.dtype.type()

    # at this point, it's guaranteed that dtype can hold both the arr values
    # and the fill_value
    if out is None:
        out_shape = len(row_idx), len(col_idx)
        out = np.empty(out_shape, dtype=dtype)

    func = _take_2d_multi_dict.get((arr.dtype.name, out.dtype.name), None)
    if func is None and arr.dtype != out.dtype:
        func = _take_2d_multi_dict.get((out.dtype.name, out.dtype.name), None)
        if func is not None:
            func = _convert_wrapper(func, out.dtype)
    if func is None:

        def func(arr, indexer, out, fill_value=np.nan):
            _take_2d_multi_object(arr, indexer, out, fill_value=fill_value,
                                  mask_info=mask_info)

    func(arr, indexer, out=out, fill_value=fill_value)
    return out


# ---- #
# diff #
# ---- #

_diff_special = {
    'float64': algos.diff_2d_float64,
    'float32': algos.diff_2d_float32,
    'int64': algos.diff_2d_int64,
    'int32': algos.diff_2d_int32,
    'int16': algos.diff_2d_int16,
    'int8': algos.diff_2d_int8,
}


def diff(arr, n, axis=0):
    """
    difference of n between self,
    analagoust to s-s.shift(n)

    Parameters
    ----------
    arr : ndarray
    n : int
        number of periods
    axis : int
        axis to shift on

    Returns
    -------
    shifted

    """

    n = int(n)
    na = np.nan
    dtype = arr.dtype

    is_timedelta = False
    if needs_i8_conversion(arr):
        dtype = np.float64
        arr = arr.view('i8')
        na = iNaT
        is_timedelta = True

    elif is_bool_dtype(dtype):
        dtype = np.object_

    elif is_integer_dtype(dtype):
        dtype = np.float64

    dtype = np.dtype(dtype)
    out_arr = np.empty(arr.shape, dtype=dtype)

    na_indexer = [slice(None)] * arr.ndim
    na_indexer[axis] = slice(None, n) if n >= 0 else slice(n, None)
    out_arr[tuple(na_indexer)] = na

    if arr.ndim == 2 and arr.dtype.name in _diff_special:
        f = _diff_special[arr.dtype.name]
        f(arr, out_arr, n, axis)
    else:
        res_indexer = [slice(None)] * arr.ndim
        res_indexer[axis] = slice(n, None) if n >= 0 else slice(None, n)
        res_indexer = tuple(res_indexer)

        lag_indexer = [slice(None)] * arr.ndim
        lag_indexer[axis] = slice(None, -n) if n > 0 else slice(-n, None)
        lag_indexer = tuple(lag_indexer)

        # need to make sure that we account for na for datelike/timedelta
        # we don't actually want to subtract these i8 numbers
        if is_timedelta:
            res = arr[res_indexer]
            lag = arr[lag_indexer]

            mask = (arr[res_indexer] == na) | (arr[lag_indexer] == na)
            if mask.any():
                res = res.copy()
                res[mask] = 0
                lag = lag.copy()
                lag[mask] = 0

            result = res - lag
            result[mask] = na
            out_arr[res_indexer] = result
        else:
            out_arr[res_indexer] = arr[res_indexer] - arr[lag_indexer]

    if is_timedelta:
        from pandas import TimedeltaIndex
        out_arr = TimedeltaIndex(out_arr.ravel().astype('int64')).asi8.reshape(
            out_arr.shape).astype('timedelta64[ns]')

    return out_arr
