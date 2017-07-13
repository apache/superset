"""
Routines for filling missing data
"""

import numpy as np
from distutils.version import LooseVersion

from pandas._libs import algos, lib

from pandas.compat import range, string_types
from pandas.core.dtypes.common import (
    is_numeric_v_string_like,
    is_float_dtype,
    is_datetime64_dtype,
    is_datetime64tz_dtype,
    is_integer_dtype,
    is_scalar,
    is_integer,
    needs_i8_conversion,
    _ensure_float64)

from pandas.core.dtypes.cast import infer_dtype_from_array
from pandas.core.dtypes.missing import isnull


def mask_missing(arr, values_to_mask):
    """
    Return a masking array of same size/shape as arr
    with entries equaling any member of values_to_mask set to True
    """
    dtype, values_to_mask = infer_dtype_from_array(values_to_mask)

    try:
        values_to_mask = np.array(values_to_mask, dtype=dtype)

    except Exception:
        values_to_mask = np.array(values_to_mask, dtype=object)

    na_mask = isnull(values_to_mask)
    nonna = values_to_mask[~na_mask]

    mask = None
    for x in nonna:
        if mask is None:

            # numpy elementwise comparison warning
            if is_numeric_v_string_like(arr, x):
                mask = False
            else:
                mask = arr == x

            # if x is a string and arr is not, then we get False and we must
            # expand the mask to size arr.shape
            if is_scalar(mask):
                mask = np.zeros(arr.shape, dtype=bool)
        else:

            # numpy elementwise comparison warning
            if is_numeric_v_string_like(arr, x):
                mask |= False
            else:
                mask |= arr == x

    if na_mask.any():
        if mask is None:
            mask = isnull(arr)
        else:
            mask |= isnull(arr)

    return mask


def clean_fill_method(method, allow_nearest=False):
    # asfreq is compat for resampling
    if method in [None, 'asfreq']:
        return None

    if isinstance(method, string_types):
        method = method.lower()
        if method == 'ffill':
            method = 'pad'
        elif method == 'bfill':
            method = 'backfill'

    valid_methods = ['pad', 'backfill']
    expecting = 'pad (ffill) or backfill (bfill)'
    if allow_nearest:
        valid_methods.append('nearest')
        expecting = 'pad (ffill), backfill (bfill) or nearest'
    if method not in valid_methods:
        msg = ('Invalid fill method. Expecting %s. Got %s' %
               (expecting, method))
        raise ValueError(msg)
    return method


def clean_interp_method(method, **kwargs):
    order = kwargs.get('order')
    valid = ['linear', 'time', 'index', 'values', 'nearest', 'zero', 'slinear',
             'quadratic', 'cubic', 'barycentric', 'polynomial', 'krogh',
             'piecewise_polynomial', 'pchip', 'akima', 'spline',
             'from_derivatives']
    if method in ('spline', 'polynomial') and order is None:
        raise ValueError("You must specify the order of the spline or "
                         "polynomial.")
    if method not in valid:
        raise ValueError("method must be one of {0}."
                         "Got '{1}' instead.".format(valid, method))

    return method


def interpolate_1d(xvalues, yvalues, method='linear', limit=None,
                   limit_direction='forward', fill_value=None,
                   bounds_error=False, order=None, **kwargs):
    """
    Logic for the 1-d interpolation.  The result should be 1-d, inputs
    xvalues and yvalues will each be 1-d arrays of the same length.

    Bounds_error is currently hardcoded to False since non-scipy ones don't
    take it as an argumnet.
    """
    # Treat the original, non-scipy methods first.

    invalid = isnull(yvalues)
    valid = ~invalid

    if not valid.any():
        # have to call np.asarray(xvalues) since xvalues could be an Index
        # which cant be mutated
        result = np.empty_like(np.asarray(xvalues), dtype=np.float64)
        result.fill(np.nan)
        return result

    if valid.all():
        return yvalues

    if method == 'time':
        if not getattr(xvalues, 'is_all_dates', None):
            # if not issubclass(xvalues.dtype.type, np.datetime64):
            raise ValueError('time-weighted interpolation only works '
                             'on Series or DataFrames with a '
                             'DatetimeIndex')
        method = 'values'

    valid_limit_directions = ['forward', 'backward', 'both']
    limit_direction = limit_direction.lower()
    if limit_direction not in valid_limit_directions:
        raise ValueError('Invalid limit_direction: expecting one of %r, got '
                         '%r.' % (valid_limit_directions, limit_direction))

    from pandas import Series
    ys = Series(yvalues)
    start_nans = set(range(ys.first_valid_index()))
    end_nans = set(range(1 + ys.last_valid_index(), len(valid)))

    # violate_limit is a list of the indexes in the series whose yvalue is
    # currently NaN, and should still be NaN after the interpolation.
    # Specifically:
    #
    # If limit_direction='forward' or None then the list will contain NaNs at
    # the beginning of the series, and NaNs that are more than 'limit' away
    # from the prior non-NaN.
    #
    # If limit_direction='backward' then the list will contain NaNs at
    # the end of the series, and NaNs that are more than 'limit' away
    # from the subsequent non-NaN.
    #
    # If limit_direction='both' then the list will contain NaNs that
    # are more than 'limit' away from any non-NaN.
    #
    # If limit=None, then use default behavior of filling an unlimited number
    # of NaNs in the direction specified by limit_direction

    # default limit is unlimited GH #16282
    if limit is None:
        # limit = len(xvalues)
        pass
    elif not is_integer(limit):
        raise ValueError('Limit must be an integer')
    elif limit < 1:
        raise ValueError('Limit must be greater than 0')

    # each possible limit_direction
    # TODO: do we need sorted?
    if limit_direction == 'forward' and limit is not None:
        violate_limit = sorted(start_nans |
                               set(_interp_limit(invalid, limit, 0)))
    elif limit_direction == 'forward':
        violate_limit = sorted(start_nans)
    elif limit_direction == 'backward' and limit is not None:
        violate_limit = sorted(end_nans |
                               set(_interp_limit(invalid, 0, limit)))
    elif limit_direction == 'backward':
        violate_limit = sorted(end_nans)
    elif limit_direction == 'both' and limit is not None:
        violate_limit = sorted(_interp_limit(invalid, limit, limit))
    else:
        violate_limit = []

    xvalues = getattr(xvalues, 'values', xvalues)
    yvalues = getattr(yvalues, 'values', yvalues)
    result = yvalues.copy()

    if method in ['linear', 'time', 'index', 'values']:
        if method in ('values', 'index'):
            inds = np.asarray(xvalues)
            # hack for DatetimeIndex, #1646
            if needs_i8_conversion(inds.dtype.type):
                inds = inds.view(np.int64)
            if inds.dtype == np.object_:
                inds = lib.maybe_convert_objects(inds)
        else:
            inds = xvalues
        result[invalid] = np.interp(inds[invalid], inds[valid], yvalues[valid])
        result[violate_limit] = np.nan
        return result

    sp_methods = ['nearest', 'zero', 'slinear', 'quadratic', 'cubic',
                  'barycentric', 'krogh', 'spline', 'polynomial',
                  'from_derivatives', 'piecewise_polynomial', 'pchip', 'akima']

    if method in sp_methods:
        inds = np.asarray(xvalues)
        # hack for DatetimeIndex, #1646
        if issubclass(inds.dtype.type, np.datetime64):
            inds = inds.view(np.int64)
        result[invalid] = _interpolate_scipy_wrapper(inds[valid],
                                                     yvalues[valid],
                                                     inds[invalid],
                                                     method=method,
                                                     fill_value=fill_value,
                                                     bounds_error=bounds_error,
                                                     order=order, **kwargs)
        result[violate_limit] = np.nan
        return result


def _interpolate_scipy_wrapper(x, y, new_x, method, fill_value=None,
                               bounds_error=False, order=None, **kwargs):
    """
    passed off to scipy.interpolate.interp1d. method is scipy's kind.
    Returns an array interpolated at new_x.  Add any new methods to
    the list in _clean_interp_method
    """
    try:
        from scipy import interpolate
        # TODO: Why is DatetimeIndex being imported here?
        from pandas import DatetimeIndex  # noqa
    except ImportError:
        raise ImportError('{0} interpolation requires Scipy'.format(method))

    new_x = np.asarray(new_x)

    # ignores some kwargs that could be passed along.
    alt_methods = {
        'barycentric': interpolate.barycentric_interpolate,
        'krogh': interpolate.krogh_interpolate,
        'from_derivatives': _from_derivatives,
        'piecewise_polynomial': _from_derivatives,
    }

    if getattr(x, 'is_all_dates', False):
        # GH 5975, scipy.interp1d can't hande datetime64s
        x, new_x = x._values.astype('i8'), new_x.astype('i8')

    if method == 'pchip':
        try:
            alt_methods['pchip'] = interpolate.pchip_interpolate
        except AttributeError:
            raise ImportError("Your version of Scipy does not support "
                              "PCHIP interpolation.")
    elif method == 'akima':
        try:
            from scipy.interpolate import Akima1DInterpolator  # noqa
            alt_methods['akima'] = _akima_interpolate
        except ImportError:
            raise ImportError("Your version of Scipy does not support "
                              "Akima interpolation.")

    interp1d_methods = ['nearest', 'zero', 'slinear', 'quadratic', 'cubic',
                        'polynomial']
    if method in interp1d_methods:
        if method == 'polynomial':
            method = order
        terp = interpolate.interp1d(x, y, kind=method, fill_value=fill_value,
                                    bounds_error=bounds_error)
        new_y = terp(new_x)
    elif method == 'spline':
        # GH #10633
        if not order:
            raise ValueError("order needs to be specified and greater than 0")
        terp = interpolate.UnivariateSpline(x, y, k=order, **kwargs)
        new_y = terp(new_x)
    else:
        # GH 7295: need to be able to write for some reason
        # in some circumstances: check all three
        if not x.flags.writeable:
            x = x.copy()
        if not y.flags.writeable:
            y = y.copy()
        if not new_x.flags.writeable:
            new_x = new_x.copy()
        method = alt_methods[method]
        new_y = method(x, y, new_x, **kwargs)
    return new_y


def _from_derivatives(xi, yi, x, order=None, der=0, extrapolate=False):
    """
    Convenience function for interpolate.BPoly.from_derivatives

    Construct a piecewise polynomial in the Bernstein basis, compatible
    with the specified values and derivatives at breakpoints.

    Parameters
    ----------
    xi : array_like
        sorted 1D array of x-coordinates
    yi : array_like or list of array-likes
        yi[i][j] is the j-th derivative known at xi[i]
    orders : None or int or array_like of ints. Default: None.
        Specifies the degree of local polynomials. If not None, some
        derivatives are ignored.
    der : int or list
        How many derivatives to extract; None for all potentially nonzero
        derivatives (that is a number equal to the number of points), or a
        list of derivatives to extract. This numberincludes the function
        value as 0th derivative.
     extrapolate : bool, optional
        Whether to extrapolate to ouf-of-bounds points based on first and last
        intervals, or to return NaNs. Default: True.

    See Also
    --------
    scipy.interpolate.BPoly.from_derivatives

    Returns
    -------
    y : scalar or array_like
        The result, of length R or length M or M by R,

    """
    import scipy
    from scipy import interpolate

    if LooseVersion(scipy.__version__) < '0.18.0':
        try:
            method = interpolate.piecewise_polynomial_interpolate
            return method(xi, yi.reshape(-1, 1), x,
                          orders=order, der=der)
        except AttributeError:
            pass

    # return the method for compat with scipy version & backwards compat
    method = interpolate.BPoly.from_derivatives
    m = method(xi, yi.reshape(-1, 1),
               orders=order, extrapolate=extrapolate)

    return m(x)


def _akima_interpolate(xi, yi, x, der=0, axis=0):
    """
    Convenience function for akima interpolation.
    xi and yi are arrays of values used to approximate some function f,
    with ``yi = f(xi)``.

    See `Akima1DInterpolator` for details.

    Parameters
    ----------
    xi : array_like
        A sorted list of x-coordinates, of length N.
    yi :  array_like
        A 1-D array of real values.  `yi`'s length along the interpolation
        axis must be equal to the length of `xi`. If N-D array, use axis
        parameter to select correct axis.
    x : scalar or array_like
        Of length M.
    der : int or list, optional
        How many derivatives to extract; None for all potentially
        nonzero derivatives (that is a number equal to the number
        of points), or a list of derivatives to extract. This number
        includes the function value as 0th derivative.
    axis : int, optional
        Axis in the yi array corresponding to the x-coordinate values.

    See Also
    --------
    scipy.interpolate.Akima1DInterpolator

    Returns
    -------
    y : scalar or array_like
        The result, of length R or length M or M by R,

    """
    from scipy import interpolate
    try:
        P = interpolate.Akima1DInterpolator(xi, yi, axis=axis)
    except TypeError:
        # Scipy earlier than 0.17.0 missing axis
        P = interpolate.Akima1DInterpolator(xi, yi)
    if der == 0:
        return P(x)
    elif interpolate._isscalar(der):
        return P(x, der=der)
    else:
        return [P(x, nu) for nu in der]


def interpolate_2d(values, method='pad', axis=0, limit=None, fill_value=None,
                   dtype=None):
    """ perform an actual interpolation of values, values will be make 2-d if
    needed fills inplace, returns the result
    """

    transf = (lambda x: x) if axis == 0 else (lambda x: x.T)

    # reshape a 1 dim if needed
    ndim = values.ndim
    if values.ndim == 1:
        if axis != 0:  # pragma: no cover
            raise AssertionError("cannot interpolate on a ndim == 1 with "
                                 "axis != 0")
        values = values.reshape(tuple((1,) + values.shape))

    if fill_value is None:
        mask = None
    else:  # todo create faster fill func without masking
        mask = mask_missing(transf(values), fill_value)

    method = clean_fill_method(method)
    if method == 'pad':
        values = transf(pad_2d(
            transf(values), limit=limit, mask=mask, dtype=dtype))
    else:
        values = transf(backfill_2d(
            transf(values), limit=limit, mask=mask, dtype=dtype))

    # reshape back
    if ndim == 1:
        values = values[0]

    return values


def _interp_wrapper(f, wrap_dtype, na_override=None):
    def wrapper(arr, mask, limit=None):
        view = arr.view(wrap_dtype)
        f(view, mask, limit=limit)

    return wrapper


_pad_1d_datetime = _interp_wrapper(algos.pad_inplace_int64, np.int64)
_pad_2d_datetime = _interp_wrapper(algos.pad_2d_inplace_int64, np.int64)
_backfill_1d_datetime = _interp_wrapper(algos.backfill_inplace_int64, np.int64)
_backfill_2d_datetime = _interp_wrapper(algos.backfill_2d_inplace_int64,
                                        np.int64)


def pad_1d(values, limit=None, mask=None, dtype=None):
    if dtype is None:
        dtype = values.dtype
    _method = None
    if is_float_dtype(values):
        _method = getattr(algos, 'pad_inplace_%s' % dtype.name, None)
    elif is_datetime64_dtype(dtype) or is_datetime64tz_dtype(dtype):
        _method = _pad_1d_datetime
    elif is_integer_dtype(values):
        values = _ensure_float64(values)
        _method = algos.pad_inplace_float64
    elif values.dtype == np.object_:
        _method = algos.pad_inplace_object

    if _method is None:
        raise ValueError('Invalid dtype for pad_1d [%s]' % dtype.name)

    if mask is None:
        mask = isnull(values)
    mask = mask.view(np.uint8)
    _method(values, mask, limit=limit)
    return values


def backfill_1d(values, limit=None, mask=None, dtype=None):
    if dtype is None:
        dtype = values.dtype
    _method = None
    if is_float_dtype(values):
        _method = getattr(algos, 'backfill_inplace_%s' % dtype.name, None)
    elif is_datetime64_dtype(dtype) or is_datetime64tz_dtype(dtype):
        _method = _backfill_1d_datetime
    elif is_integer_dtype(values):
        values = _ensure_float64(values)
        _method = algos.backfill_inplace_float64
    elif values.dtype == np.object_:
        _method = algos.backfill_inplace_object

    if _method is None:
        raise ValueError('Invalid dtype for backfill_1d [%s]' % dtype.name)

    if mask is None:
        mask = isnull(values)
    mask = mask.view(np.uint8)

    _method(values, mask, limit=limit)
    return values


def pad_2d(values, limit=None, mask=None, dtype=None):
    if dtype is None:
        dtype = values.dtype
    _method = None
    if is_float_dtype(values):
        _method = getattr(algos, 'pad_2d_inplace_%s' % dtype.name, None)
    elif is_datetime64_dtype(dtype) or is_datetime64tz_dtype(dtype):
        _method = _pad_2d_datetime
    elif is_integer_dtype(values):
        values = _ensure_float64(values)
        _method = algos.pad_2d_inplace_float64
    elif values.dtype == np.object_:
        _method = algos.pad_2d_inplace_object

    if _method is None:
        raise ValueError('Invalid dtype for pad_2d [%s]' % dtype.name)

    if mask is None:
        mask = isnull(values)
    mask = mask.view(np.uint8)

    if np.all(values.shape):
        _method(values, mask, limit=limit)
    else:
        # for test coverage
        pass
    return values


def backfill_2d(values, limit=None, mask=None, dtype=None):
    if dtype is None:
        dtype = values.dtype
    _method = None
    if is_float_dtype(values):
        _method = getattr(algos, 'backfill_2d_inplace_%s' % dtype.name, None)
    elif is_datetime64_dtype(dtype) or is_datetime64tz_dtype(dtype):
        _method = _backfill_2d_datetime
    elif is_integer_dtype(values):
        values = _ensure_float64(values)
        _method = algos.backfill_2d_inplace_float64
    elif values.dtype == np.object_:
        _method = algos.backfill_2d_inplace_object

    if _method is None:
        raise ValueError('Invalid dtype for backfill_2d [%s]' % dtype.name)

    if mask is None:
        mask = isnull(values)
    mask = mask.view(np.uint8)

    if np.all(values.shape):
        _method(values, mask, limit=limit)
    else:
        # for test coverage
        pass
    return values


_fill_methods = {'pad': pad_1d, 'backfill': backfill_1d}


def get_fill_func(method):
    method = clean_fill_method(method)
    return _fill_methods[method]


def clean_reindex_fill_method(method):
    return clean_fill_method(method, allow_nearest=True)


def fill_zeros(result, x, y, name, fill):
    """
    if this is a reversed op, then flip x,y

    if we have an integer value (or array in y)
    and we have 0's, fill them with the fill,
    return the result

    mask the nan's from x
    """
    if fill is None or is_float_dtype(result):
        return result

    if name.startswith(('r', '__r')):
        x, y = y, x

    is_variable_type = (hasattr(y, 'dtype') or hasattr(y, 'type'))
    is_scalar_type = is_scalar(y)

    if not is_variable_type and not is_scalar_type:
        return result

    if is_scalar_type:
        y = np.array(y)

    if is_integer_dtype(y):

        if (y == 0).any():

            # GH 7325, mask and nans must be broadcastable (also: PR 9308)
            # Raveling and then reshaping makes np.putmask faster
            mask = ((y == 0) & ~np.isnan(result)).ravel()

            shape = result.shape
            result = result.astype('float64', copy=False).ravel()

            np.putmask(result, mask, fill)

            # if we have a fill of inf, then sign it correctly
            # (GH 6178 and PR 9308)
            if np.isinf(fill):
                signs = np.sign(y if name.startswith(('r', '__r')) else x)
                negative_inf_mask = (signs.ravel() < 0) & mask
                np.putmask(result, negative_inf_mask, -fill)

            if "floordiv" in name:  # (PR 9308)
                nan_mask = ((y == 0) & (x == 0)).ravel()
                np.putmask(result, nan_mask, np.nan)

            result = result.reshape(shape)

    return result


def _interp_limit(invalid, fw_limit, bw_limit):
    """Get idx of values that won't be filled b/c they exceed the limits.

    This is equivalent to the more readable, but slower

    .. code-block:: python

       for x in np.where(invalid)[0]:
           if invalid[max(0, x - fw_limit):x + bw_limit + 1].all():
               yield x
    """
    # handle forward first; the backward direction is the same except
    # 1. operate on the reversed array
    # 2. subtract the returned indicies from N - 1
    N = len(invalid)

    def inner(invalid, limit):
        limit = min(limit, N)
        windowed = _rolling_window(invalid, limit + 1).all(1)
        idx = (set(np.where(windowed)[0] + limit) |
               set(np.where((~invalid[:limit + 1]).cumsum() == 0)[0]))
        return idx

    if fw_limit == 0:
        f_idx = set(np.where(invalid)[0])
    else:
        f_idx = inner(invalid, fw_limit)

    if bw_limit == 0:
        # then we don't even need to care about backwards, just use forwards
        return f_idx
    else:
        b_idx = set(N - 1 - np.asarray(list(inner(invalid[::-1], bw_limit))))
        if fw_limit == 0:
            return b_idx
    return f_idx & b_idx


def _rolling_window(a, window):
    """
    [True, True, False, True, False], 2 ->

    [
        [True,  True],
        [True, False],
        [False, True],
        [True, False],
    ]
    """
    # https://stackoverflow.com/a/6811241
    shape = a.shape[:-1] + (a.shape[-1] - window + 1, window)
    strides = a.strides + (a.strides[-1],)
    return np.lib.stride_tricks.as_strided(a, shape=shape, strides=strides)
