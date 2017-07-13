"""
Quantilization functions and related stuff
"""

from pandas.core.dtypes.missing import isnull
from pandas.core.dtypes.common import (
    is_integer,
    is_scalar,
    is_categorical_dtype,
    is_datetime64_dtype,
    is_timedelta64_dtype,
    _ensure_int64)

import pandas.core.algorithms as algos
import pandas.core.nanops as nanops
from pandas._libs.lib import infer_dtype
from pandas import (to_timedelta, to_datetime,
                    Categorical, Timestamp, Timedelta,
                    Series, Interval, IntervalIndex)

import numpy as np


def cut(x, bins, right=True, labels=None, retbins=False, precision=3,
        include_lowest=False):
    """
    Return indices of half-open bins to which each value of `x` belongs.

    Parameters
    ----------
    x : array-like
        Input array to be binned. It has to be 1-dimensional.
    bins : int, sequence of scalars, or IntervalIndex
        If `bins` is an int, it defines the number of equal-width bins in the
        range of `x`. However, in this case, the range of `x` is extended
        by .1% on each side to include the min or max values of `x`. If
        `bins` is a sequence it defines the bin edges allowing for
        non-uniform bin width. No extension of the range of `x` is done in
        this case.
    right : bool, optional
        Indicates whether the bins include the rightmost edge or not. If
        right == True (the default), then the bins [1,2,3,4] indicate
        (1,2], (2,3], (3,4].
    labels : array or boolean, default None
        Used as labels for the resulting bins. Must be of the same length as
        the resulting bins. If False, return only integer indicators of the
        bins.
    retbins : bool, optional
        Whether to return the bins or not. Can be useful if bins is given
        as a scalar.
    precision : int, optional
        The precision at which to store and display the bins labels
    include_lowest : bool, optional
        Whether the first interval should be left-inclusive or not.

    Returns
    -------
    out : Categorical or Series or array of integers if labels is False
        The return type (Categorical or Series) depends on the input: a Series
        of type category if input is a Series else Categorical. Bins are
        represented as categories when categorical data is returned.
    bins : ndarray of floats
        Returned only if `retbins` is True.

    Notes
    -----
    The `cut` function can be useful for going from a continuous variable to
    a categorical variable. For example, `cut` could convert ages to groups
    of age ranges.

    Any NA values will be NA in the result.  Out of bounds values will be NA in
    the resulting Categorical object


    Examples
    --------
    >>> pd.cut(np.array([.2, 1.4, 2.5, 6.2, 9.7, 2.1]), 3, retbins=True)
    ([(0.191, 3.367], (0.191, 3.367], (0.191, 3.367], (3.367, 6.533],
      (6.533, 9.7], (0.191, 3.367]]
    Categories (3, object): [(0.191, 3.367] < (3.367, 6.533] < (6.533, 9.7]],
    array([ 0.1905    ,  3.36666667,  6.53333333,  9.7       ]))

    >>> pd.cut(np.array([.2, 1.4, 2.5, 6.2, 9.7, 2.1]), 3,
               labels=["good","medium","bad"])
    [good, good, good, medium, bad, good]
    Categories (3, object): [good < medium < bad]

    >>> pd.cut(np.ones(5), 4, labels=False)
    array([1, 1, 1, 1, 1], dtype=int64)
    """
    # NOTE: this binning code is changed a bit from histogram for var(x) == 0

    # for handling the cut for datetime and timedelta objects
    x_is_series, series_index, name, x = _preprocess_for_cut(x)
    x, dtype = _coerce_to_type(x)

    if not np.iterable(bins):
        if is_scalar(bins) and bins < 1:
            raise ValueError("`bins` should be a positive integer.")

        try:  # for array-like
            sz = x.size
        except AttributeError:
            x = np.asarray(x)
            sz = x.size

        if sz == 0:
            raise ValueError('Cannot cut empty array')

        rng = (nanops.nanmin(x), nanops.nanmax(x))
        mn, mx = [mi + 0.0 for mi in rng]

        if mn == mx:  # adjust end points before binning
            mn -= .001 * abs(mn) if mn != 0 else .001
            mx += .001 * abs(mx) if mx != 0 else .001
            bins = np.linspace(mn, mx, bins + 1, endpoint=True)
        else:  # adjust end points after binning
            bins = np.linspace(mn, mx, bins + 1, endpoint=True)
            adj = (mx - mn) * 0.001  # 0.1% of the range
            if right:
                bins[0] -= adj
            else:
                bins[-1] += adj

    elif isinstance(bins, IntervalIndex):
        pass
    else:
        bins = np.asarray(bins)
        bins = _convert_bin_to_numeric_type(bins, dtype)
        if (np.diff(bins) < 0).any():
            raise ValueError('bins must increase monotonically.')

    fac, bins = _bins_to_cuts(x, bins, right=right, labels=labels,
                              precision=precision,
                              include_lowest=include_lowest,
                              dtype=dtype)

    return _postprocess_for_cut(fac, bins, retbins, x_is_series,
                                series_index, name)


def qcut(x, q, labels=None, retbins=False, precision=3, duplicates='raise'):
    """
    Quantile-based discretization function. Discretize variable into
    equal-sized buckets based on rank or based on sample quantiles. For example
    1000 values for 10 quantiles would produce a Categorical object indicating
    quantile membership for each data point.

    Parameters
    ----------
    x : ndarray or Series
    q : integer or array of quantiles
        Number of quantiles. 10 for deciles, 4 for quartiles, etc. Alternately
        array of quantiles, e.g. [0, .25, .5, .75, 1.] for quartiles
    labels : array or boolean, default None
        Used as labels for the resulting bins. Must be of the same length as
        the resulting bins. If False, return only integer indicators of the
        bins.
    retbins : bool, optional
        Whether to return the (bins, labels) or not. Can be useful if bins
        is given as a scalar.
    precision : int, optional
        The precision at which to store and display the bins labels
    duplicates : {default 'raise', 'drop'}, optional
        If bin edges are not unique, raise ValueError or drop non-uniques.

        .. versionadded:: 0.20.0

    Returns
    -------
    out : Categorical or Series or array of integers if labels is False
        The return type (Categorical or Series) depends on the input: a Series
        of type category if input is a Series else Categorical. Bins are
        represented as categories when categorical data is returned.
    bins : ndarray of floats
        Returned only if `retbins` is True.

    Notes
    -----
    Out of bounds values will be NA in the resulting Categorical object

    Examples
    --------
    >>> pd.qcut(range(5), 4)
    [[0, 1], [0, 1], (1, 2], (2, 3], (3, 4]]
    Categories (4, object): [[0, 1] < (1, 2] < (2, 3] < (3, 4]]

    >>> pd.qcut(range(5), 3, labels=["good","medium","bad"])
    [good, good, medium, bad, bad]
    Categories (3, object): [good < medium < bad]

    >>> pd.qcut(range(5), 4, labels=False)
    array([0, 0, 1, 2, 3], dtype=int64)
    """
    x_is_series, series_index, name, x = _preprocess_for_cut(x)

    x, dtype = _coerce_to_type(x)

    if is_integer(q):
        quantiles = np.linspace(0, 1, q + 1)
    else:
        quantiles = q
    bins = algos.quantile(x, quantiles)
    fac, bins = _bins_to_cuts(x, bins, labels=labels,
                              precision=precision, include_lowest=True,
                              dtype=dtype, duplicates=duplicates)

    return _postprocess_for_cut(fac, bins, retbins, x_is_series,
                                series_index, name)


def _bins_to_cuts(x, bins, right=True, labels=None,
                  precision=3, include_lowest=False,
                  dtype=None, duplicates='raise'):

    if duplicates not in ['raise', 'drop']:
        raise ValueError("invalid value for 'duplicates' parameter, "
                         "valid options are: raise, drop")

    if isinstance(bins, IntervalIndex):
        # we have a fast-path here
        ids = bins.get_indexer(x)
        result = algos.take_nd(bins, ids)
        result = Categorical(result, categories=bins, ordered=True)
        return result, bins

    unique_bins = algos.unique(bins)
    if len(unique_bins) < len(bins) and len(bins) != 2:
        if duplicates == 'raise':
            raise ValueError("Bin edges must be unique: {}.\nYou "
                             "can drop duplicate edges by setting "
                             "the 'duplicates' kwarg".format(repr(bins)))
        else:
            bins = unique_bins

    side = 'left' if right else 'right'
    ids = _ensure_int64(bins.searchsorted(x, side=side))

    if include_lowest:
        ids[x == bins[0]] = 1

    na_mask = isnull(x) | (ids == len(bins)) | (ids == 0)
    has_nas = na_mask.any()

    if labels is not False:
        if labels is None:
            labels = _format_labels(bins, precision, right=right,
                                    include_lowest=include_lowest,
                                    dtype=dtype)
        else:
            if len(labels) != len(bins) - 1:
                raise ValueError('Bin labels must be one fewer than '
                                 'the number of bin edges')
        if not is_categorical_dtype(labels):
            labels = Categorical(labels, categories=labels, ordered=True)

        np.putmask(ids, na_mask, 0)
        result = algos.take_nd(labels, ids - 1)

    else:
        result = ids - 1
        if has_nas:
            result = result.astype(np.float64)
            np.putmask(result, na_mask, np.nan)

    return result, bins


def _trim_zeros(x):
    while len(x) > 1 and x[-1] == '0':
        x = x[:-1]
    if len(x) > 1 and x[-1] == '.':
        x = x[:-1]
    return x


def _coerce_to_type(x):
    """
    if the passed data is of datetime/timedelta type,
    this method converts it to integer so that cut method can
    handle it
    """
    dtype = None

    if is_timedelta64_dtype(x):
        x = to_timedelta(x).view(np.int64)
        dtype = np.timedelta64
    elif is_datetime64_dtype(x):
        x = to_datetime(x).view(np.int64)
        dtype = np.datetime64

    return x, dtype


def _convert_bin_to_numeric_type(bins, dtype):
    """
    if the passed bin is of datetime/timedelta type,
    this method converts it to integer

    Parameters
    ----------
    bins : list-liek of bins
    dtype : dtype of data

    Raises
    ------
    ValueError if bins are not of a compat dtype to dtype
    """
    bins_dtype = infer_dtype(bins)
    if is_timedelta64_dtype(dtype):
        if bins_dtype in ['timedelta', 'timedelta64']:
            bins = to_timedelta(bins).view(np.int64)
        else:
            raise ValueError("bins must be of timedelta64 dtype")
    elif is_datetime64_dtype(dtype):
        if bins_dtype in ['datetime', 'datetime64']:
            bins = to_datetime(bins).view(np.int64)
        else:
            raise ValueError("bins must be of datetime64 dtype")

    return bins


def _format_labels(bins, precision, right=True,
                   include_lowest=False, dtype=None):
    """ based on the dtype, return our labels """

    closed = 'right' if right else 'left'

    if is_datetime64_dtype(dtype):
        formatter = Timestamp
        adjust = lambda x: x - Timedelta('1ns')
    elif is_timedelta64_dtype(dtype):
        formatter = Timedelta
        adjust = lambda x: x - Timedelta('1ns')
    else:
        precision = _infer_precision(precision, bins)
        formatter = lambda x: _round_frac(x, precision)
        adjust = lambda x: x - 10 ** (-precision)

    breaks = [formatter(b) for b in bins]
    labels = IntervalIndex.from_breaks(breaks, closed=closed)

    if right and include_lowest:
        # we will adjust the left hand side by precision to
        # account that we are all right closed
        v = adjust(labels[0].left)

        i = IntervalIndex.from_intervals(
            [Interval(v, labels[0].right, closed='right')])
        labels = i.append(labels[1:])

    return labels


def _preprocess_for_cut(x):
    """
    handles preprocessing for cut where we convert passed
    input to array, strip the index information and store it
    seperately
    """
    x_is_series = isinstance(x, Series)
    series_index = None
    name = None

    if x_is_series:
        series_index = x.index
        name = x.name

    x = np.asarray(x)

    return x_is_series, series_index, name, x


def _postprocess_for_cut(fac, bins, retbins, x_is_series,
                         series_index, name):
    """
    handles post processing for the cut method where
    we combine the index information if the originally passed
    datatype was a series
    """
    if x_is_series:
        fac = Series(fac, index=series_index, name=name)

    if not retbins:
        return fac

    return fac, bins


def _round_frac(x, precision):
    """
    Round the fractional part of the given number
    """
    if not np.isfinite(x) or x == 0:
        return x
    else:
        frac, whole = np.modf(x)
        if whole == 0:
            digits = -int(np.floor(np.log10(abs(frac)))) - 1 + precision
        else:
            digits = precision
        return np.around(x, digits)


def _infer_precision(base_precision, bins):
    """Infer an appropriate precision for _round_frac
    """
    for precision in range(base_precision, 20):
        levels = [_round_frac(b, precision) for b in bins]
        if algos.unique(levels).size == bins.size:
            return precision
    return base_precision  # default
