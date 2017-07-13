"""
The arraypad module contains a group of functions to pad values onto the edges
of an n-dimensional array.

"""
from __future__ import division, absolute_import, print_function

import numpy as np


__all__ = ['pad']


###############################################################################
# Private utility functions.


def _arange_ndarray(arr, shape, axis, reverse=False):
    """
    Create an ndarray of `shape` with increments along specified `axis`

    Parameters
    ----------
    arr : ndarray
        Input array of arbitrary shape.
    shape : tuple of ints
        Shape of desired array. Should be equivalent to `arr.shape` except
        `shape[axis]` which may have any positive value.
    axis : int
        Axis to increment along.
    reverse : bool
        If False, increment in a positive fashion from 1 to `shape[axis]`,
        inclusive. If True, the bounds are the same but the order reversed.

    Returns
    -------
    padarr : ndarray
        Output array sized to pad `arr` along `axis`, with linear range from
        1 to `shape[axis]` along specified `axis`.

    Notes
    -----
    The range is deliberately 1-indexed for this specific use case. Think of
    this algorithm as broadcasting `np.arange` to a single `axis` of an
    arbitrarily shaped ndarray.

    """
    initshape = tuple(1 if i != axis else shape[axis]
                      for (i, x) in enumerate(arr.shape))
    if not reverse:
        padarr = np.arange(1, shape[axis] + 1)
    else:
        padarr = np.arange(shape[axis], 0, -1)
    padarr = padarr.reshape(initshape)
    for i, dim in enumerate(shape):
        if padarr.shape[i] != dim:
            padarr = padarr.repeat(dim, axis=i)
    return padarr


def _round_ifneeded(arr, dtype):
    """
    Rounds arr inplace if destination dtype is integer.

    Parameters
    ----------
    arr : ndarray
        Input array.
    dtype : dtype
        The dtype of the destination array.

    """
    if np.issubdtype(dtype, np.integer):
        arr.round(out=arr)


def _prepend_const(arr, pad_amt, val, axis=-1):
    """
    Prepend constant `val` along `axis` of `arr`.

    Parameters
    ----------
    arr : ndarray
        Input array of arbitrary shape.
    pad_amt : int
        Amount of padding to prepend.
    val : scalar
        Constant value to use. For best results should be of type `arr.dtype`;
        if not `arr.dtype` will be cast to `arr.dtype`.
    axis : int
        Axis along which to pad `arr`.

    Returns
    -------
    padarr : ndarray
        Output array, with `pad_amt` constant `val` prepended along `axis`.

    """
    if pad_amt == 0:
        return arr
    padshape = tuple(x if i != axis else pad_amt
                     for (i, x) in enumerate(arr.shape))
    if val == 0:
        return np.concatenate((np.zeros(padshape, dtype=arr.dtype), arr),
                              axis=axis)
    else:
        return np.concatenate(((np.zeros(padshape) + val).astype(arr.dtype),
                               arr), axis=axis)


def _append_const(arr, pad_amt, val, axis=-1):
    """
    Append constant `val` along `axis` of `arr`.

    Parameters
    ----------
    arr : ndarray
        Input array of arbitrary shape.
    pad_amt : int
        Amount of padding to append.
    val : scalar
        Constant value to use. For best results should be of type `arr.dtype`;
        if not `arr.dtype` will be cast to `arr.dtype`.
    axis : int
        Axis along which to pad `arr`.

    Returns
    -------
    padarr : ndarray
        Output array, with `pad_amt` constant `val` appended along `axis`.

    """
    if pad_amt == 0:
        return arr
    padshape = tuple(x if i != axis else pad_amt
                     for (i, x) in enumerate(arr.shape))
    if val == 0:
        return np.concatenate((arr, np.zeros(padshape, dtype=arr.dtype)),
                              axis=axis)
    else:
        return np.concatenate(
            (arr, (np.zeros(padshape) + val).astype(arr.dtype)), axis=axis)


def _prepend_edge(arr, pad_amt, axis=-1):
    """
    Prepend `pad_amt` to `arr` along `axis` by extending edge values.

    Parameters
    ----------
    arr : ndarray
        Input array of arbitrary shape.
    pad_amt : int
        Amount of padding to prepend.
    axis : int
        Axis along which to pad `arr`.

    Returns
    -------
    padarr : ndarray
        Output array, extended by `pad_amt` edge values appended along `axis`.

    """
    if pad_amt == 0:
        return arr

    edge_slice = tuple(slice(None) if i != axis else 0
                       for (i, x) in enumerate(arr.shape))

    # Shape to restore singleton dimension after slicing
    pad_singleton = tuple(x if i != axis else 1
                          for (i, x) in enumerate(arr.shape))
    edge_arr = arr[edge_slice].reshape(pad_singleton)
    return np.concatenate((edge_arr.repeat(pad_amt, axis=axis), arr),
                          axis=axis)


def _append_edge(arr, pad_amt, axis=-1):
    """
    Append `pad_amt` to `arr` along `axis` by extending edge values.

    Parameters
    ----------
    arr : ndarray
        Input array of arbitrary shape.
    pad_amt : int
        Amount of padding to append.
    axis : int
        Axis along which to pad `arr`.

    Returns
    -------
    padarr : ndarray
        Output array, extended by `pad_amt` edge values prepended along
        `axis`.

    """
    if pad_amt == 0:
        return arr

    edge_slice = tuple(slice(None) if i != axis else arr.shape[axis] - 1
                       for (i, x) in enumerate(arr.shape))

    # Shape to restore singleton dimension after slicing
    pad_singleton = tuple(x if i != axis else 1
                          for (i, x) in enumerate(arr.shape))
    edge_arr = arr[edge_slice].reshape(pad_singleton)
    return np.concatenate((arr, edge_arr.repeat(pad_amt, axis=axis)),
                          axis=axis)


def _prepend_ramp(arr, pad_amt, end, axis=-1):
    """
    Prepend linear ramp along `axis`.

    Parameters
    ----------
    arr : ndarray
        Input array of arbitrary shape.
    pad_amt : int
        Amount of padding to prepend.
    end : scalar
        Constal value to use. For best results should be of type `arr.dtype`;
        if not `arr.dtype` will be cast to `arr.dtype`.
    axis : int
        Axis along which to pad `arr`.

    Returns
    -------
    padarr : ndarray
        Output array, with `pad_amt` values prepended along `axis`. The
        prepended region ramps linearly from the edge value to `end`.

    """
    if pad_amt == 0:
        return arr

    # Generate shape for final concatenated array
    padshape = tuple(x if i != axis else pad_amt
                     for (i, x) in enumerate(arr.shape))

    # Generate an n-dimensional array incrementing along `axis`
    ramp_arr = _arange_ndarray(arr, padshape, axis,
                               reverse=True).astype(np.float64)

    # Appropriate slicing to extract n-dimensional edge along `axis`
    edge_slice = tuple(slice(None) if i != axis else 0
                       for (i, x) in enumerate(arr.shape))

    # Shape to restore singleton dimension after slicing
    pad_singleton = tuple(x if i != axis else 1
                          for (i, x) in enumerate(arr.shape))

    # Extract edge, reshape to original rank, and extend along `axis`
    edge_pad = arr[edge_slice].reshape(pad_singleton).repeat(pad_amt, axis)

    # Linear ramp
    slope = (end - edge_pad) / float(pad_amt)
    ramp_arr = ramp_arr * slope
    ramp_arr += edge_pad
    _round_ifneeded(ramp_arr, arr.dtype)

    # Ramp values will most likely be float, cast them to the same type as arr
    return np.concatenate((ramp_arr.astype(arr.dtype), arr), axis=axis)


def _append_ramp(arr, pad_amt, end, axis=-1):
    """
    Append linear ramp along `axis`.

    Parameters
    ----------
    arr : ndarray
        Input array of arbitrary shape.
    pad_amt : int
        Amount of padding to append.
    end : scalar
        Constal value to use. For best results should be of type `arr.dtype`;
        if not `arr.dtype` will be cast to `arr.dtype`.
    axis : int
        Axis along which to pad `arr`.

    Returns
    -------
    padarr : ndarray
        Output array, with `pad_amt` values appended along `axis`. The
        appended region ramps linearly from the edge value to `end`.

    """
    if pad_amt == 0:
        return arr

    # Generate shape for final concatenated array
    padshape = tuple(x if i != axis else pad_amt
                     for (i, x) in enumerate(arr.shape))

    # Generate an n-dimensional array incrementing along `axis`
    ramp_arr = _arange_ndarray(arr, padshape, axis,
                               reverse=False).astype(np.float64)

    # Slice a chunk from the edge to calculate stats on
    edge_slice = tuple(slice(None) if i != axis else -1
                       for (i, x) in enumerate(arr.shape))

    # Shape to restore singleton dimension after slicing
    pad_singleton = tuple(x if i != axis else 1
                          for (i, x) in enumerate(arr.shape))

    # Extract edge, reshape to original rank, and extend along `axis`
    edge_pad = arr[edge_slice].reshape(pad_singleton).repeat(pad_amt, axis)

    # Linear ramp
    slope = (end - edge_pad) / float(pad_amt)
    ramp_arr = ramp_arr * slope
    ramp_arr += edge_pad
    _round_ifneeded(ramp_arr, arr.dtype)

    # Ramp values will most likely be float, cast them to the same type as arr
    return np.concatenate((arr, ramp_arr.astype(arr.dtype)), axis=axis)


def _prepend_max(arr, pad_amt, num, axis=-1):
    """
    Prepend `pad_amt` maximum values along `axis`.

    Parameters
    ----------
    arr : ndarray
        Input array of arbitrary shape.
    pad_amt : int
        Amount of padding to prepend.
    num : int
        Depth into `arr` along `axis` to calculate maximum.
        Range: [1, `arr.shape[axis]`] or None (entire axis)
    axis : int
        Axis along which to pad `arr`.

    Returns
    -------
    padarr : ndarray
        Output array, with `pad_amt` values appended along `axis`. The
        prepended region is the maximum of the first `num` values along
        `axis`.

    """
    if pad_amt == 0:
        return arr

    # Equivalent to edge padding for single value, so do that instead
    if num == 1:
        return _prepend_edge(arr, pad_amt, axis)

    # Use entire array if `num` is too large
    if num is not None:
        if num >= arr.shape[axis]:
            num = None

    # Slice a chunk from the edge to calculate stats on
    max_slice = tuple(slice(None) if i != axis else slice(num)
                      for (i, x) in enumerate(arr.shape))

    # Shape to restore singleton dimension after slicing
    pad_singleton = tuple(x if i != axis else 1
                          for (i, x) in enumerate(arr.shape))

    # Extract slice, calculate max, reshape to add singleton dimension back
    max_chunk = arr[max_slice].max(axis=axis).reshape(pad_singleton)

    # Concatenate `arr` with `max_chunk`, extended along `axis` by `pad_amt`
    return np.concatenate((max_chunk.repeat(pad_amt, axis=axis), arr),
                          axis=axis)


def _append_max(arr, pad_amt, num, axis=-1):
    """
    Pad one `axis` of `arr` with the maximum of the last `num` elements.

    Parameters
    ----------
    arr : ndarray
        Input array of arbitrary shape.
    pad_amt : int
        Amount of padding to append.
    num : int
        Depth into `arr` along `axis` to calculate maximum.
        Range: [1, `arr.shape[axis]`] or None (entire axis)
    axis : int
        Axis along which to pad `arr`.

    Returns
    -------
    padarr : ndarray
        Output array, with `pad_amt` values appended along `axis`. The
        appended region is the maximum of the final `num` values along `axis`.

    """
    if pad_amt == 0:
        return arr

    # Equivalent to edge padding for single value, so do that instead
    if num == 1:
        return _append_edge(arr, pad_amt, axis)

    # Use entire array if `num` is too large
    if num is not None:
        if num >= arr.shape[axis]:
            num = None

    # Slice a chunk from the edge to calculate stats on
    end = arr.shape[axis] - 1
    if num is not None:
        max_slice = tuple(
            slice(None) if i != axis else slice(end, end - num, -1)
            for (i, x) in enumerate(arr.shape))
    else:
        max_slice = tuple(slice(None) for x in arr.shape)

    # Shape to restore singleton dimension after slicing
    pad_singleton = tuple(x if i != axis else 1
                          for (i, x) in enumerate(arr.shape))

    # Extract slice, calculate max, reshape to add singleton dimension back
    max_chunk = arr[max_slice].max(axis=axis).reshape(pad_singleton)

    # Concatenate `arr` with `max_chunk`, extended along `axis` by `pad_amt`
    return np.concatenate((arr, max_chunk.repeat(pad_amt, axis=axis)),
                          axis=axis)


def _prepend_mean(arr, pad_amt, num, axis=-1):
    """
    Prepend `pad_amt` mean values along `axis`.

    Parameters
    ----------
    arr : ndarray
        Input array of arbitrary shape.
    pad_amt : int
        Amount of padding to prepend.
    num : int
        Depth into `arr` along `axis` to calculate mean.
        Range: [1, `arr.shape[axis]`] or None (entire axis)
    axis : int
        Axis along which to pad `arr`.

    Returns
    -------
    padarr : ndarray
        Output array, with `pad_amt` values prepended along `axis`. The
        prepended region is the mean of the first `num` values along `axis`.

    """
    if pad_amt == 0:
        return arr

    # Equivalent to edge padding for single value, so do that instead
    if num == 1:
        return _prepend_edge(arr, pad_amt, axis)

    # Use entire array if `num` is too large
    if num is not None:
        if num >= arr.shape[axis]:
            num = None

    # Slice a chunk from the edge to calculate stats on
    mean_slice = tuple(slice(None) if i != axis else slice(num)
                       for (i, x) in enumerate(arr.shape))

    # Shape to restore singleton dimension after slicing
    pad_singleton = tuple(x if i != axis else 1
                          for (i, x) in enumerate(arr.shape))

    # Extract slice, calculate mean, reshape to add singleton dimension back
    mean_chunk = arr[mean_slice].mean(axis).reshape(pad_singleton)
    _round_ifneeded(mean_chunk, arr.dtype)

    # Concatenate `arr` with `mean_chunk`, extended along `axis` by `pad_amt`
    return np.concatenate((mean_chunk.repeat(pad_amt, axis).astype(arr.dtype),
                           arr), axis=axis)


def _append_mean(arr, pad_amt, num, axis=-1):
    """
    Append `pad_amt` mean values along `axis`.

    Parameters
    ----------
    arr : ndarray
        Input array of arbitrary shape.
    pad_amt : int
        Amount of padding to append.
    num : int
        Depth into `arr` along `axis` to calculate mean.
        Range: [1, `arr.shape[axis]`] or None (entire axis)
    axis : int
        Axis along which to pad `arr`.

    Returns
    -------
    padarr : ndarray
        Output array, with `pad_amt` values appended along `axis`. The
        appended region is the maximum of the final `num` values along `axis`.

    """
    if pad_amt == 0:
        return arr

    # Equivalent to edge padding for single value, so do that instead
    if num == 1:
        return _append_edge(arr, pad_amt, axis)

    # Use entire array if `num` is too large
    if num is not None:
        if num >= arr.shape[axis]:
            num = None

    # Slice a chunk from the edge to calculate stats on
    end = arr.shape[axis] - 1
    if num is not None:
        mean_slice = tuple(
            slice(None) if i != axis else slice(end, end - num, -1)
            for (i, x) in enumerate(arr.shape))
    else:
        mean_slice = tuple(slice(None) for x in arr.shape)

    # Shape to restore singleton dimension after slicing
    pad_singleton = tuple(x if i != axis else 1
                          for (i, x) in enumerate(arr.shape))

    # Extract slice, calculate mean, reshape to add singleton dimension back
    mean_chunk = arr[mean_slice].mean(axis=axis).reshape(pad_singleton)
    _round_ifneeded(mean_chunk, arr.dtype)

    # Concatenate `arr` with `mean_chunk`, extended along `axis` by `pad_amt`
    return np.concatenate(
        (arr, mean_chunk.repeat(pad_amt, axis).astype(arr.dtype)), axis=axis)


def _prepend_med(arr, pad_amt, num, axis=-1):
    """
    Prepend `pad_amt` median values along `axis`.

    Parameters
    ----------
    arr : ndarray
        Input array of arbitrary shape.
    pad_amt : int
        Amount of padding to prepend.
    num : int
        Depth into `arr` along `axis` to calculate median.
        Range: [1, `arr.shape[axis]`] or None (entire axis)
    axis : int
        Axis along which to pad `arr`.

    Returns
    -------
    padarr : ndarray
        Output array, with `pad_amt` values prepended along `axis`. The
        prepended region is the median of the first `num` values along `axis`.

    """
    if pad_amt == 0:
        return arr

    # Equivalent to edge padding for single value, so do that instead
    if num == 1:
        return _prepend_edge(arr, pad_amt, axis)

    # Use entire array if `num` is too large
    if num is not None:
        if num >= arr.shape[axis]:
            num = None

    # Slice a chunk from the edge to calculate stats on
    med_slice = tuple(slice(None) if i != axis else slice(num)
                      for (i, x) in enumerate(arr.shape))

    # Shape to restore singleton dimension after slicing
    pad_singleton = tuple(x if i != axis else 1
                          for (i, x) in enumerate(arr.shape))

    # Extract slice, calculate median, reshape to add singleton dimension back
    med_chunk = np.median(arr[med_slice], axis=axis).reshape(pad_singleton)
    _round_ifneeded(med_chunk, arr.dtype)

    # Concatenate `arr` with `med_chunk`, extended along `axis` by `pad_amt`
    return np.concatenate(
        (med_chunk.repeat(pad_amt, axis).astype(arr.dtype), arr), axis=axis)


def _append_med(arr, pad_amt, num, axis=-1):
    """
    Append `pad_amt` median values along `axis`.

    Parameters
    ----------
    arr : ndarray
        Input array of arbitrary shape.
    pad_amt : int
        Amount of padding to append.
    num : int
        Depth into `arr` along `axis` to calculate median.
        Range: [1, `arr.shape[axis]`] or None (entire axis)
    axis : int
        Axis along which to pad `arr`.

    Returns
    -------
    padarr : ndarray
        Output array, with `pad_amt` values appended along `axis`. The
        appended region is the median of the final `num` values along `axis`.

    """
    if pad_amt == 0:
        return arr

    # Equivalent to edge padding for single value, so do that instead
    if num == 1:
        return _append_edge(arr, pad_amt, axis)

    # Use entire array if `num` is too large
    if num is not None:
        if num >= arr.shape[axis]:
            num = None

    # Slice a chunk from the edge to calculate stats on
    end = arr.shape[axis] - 1
    if num is not None:
        med_slice = tuple(
            slice(None) if i != axis else slice(end, end - num, -1)
            for (i, x) in enumerate(arr.shape))
    else:
        med_slice = tuple(slice(None) for x in arr.shape)

    # Shape to restore singleton dimension after slicing
    pad_singleton = tuple(x if i != axis else 1
                          for (i, x) in enumerate(arr.shape))

    # Extract slice, calculate median, reshape to add singleton dimension back
    med_chunk = np.median(arr[med_slice], axis=axis).reshape(pad_singleton)
    _round_ifneeded(med_chunk, arr.dtype)

    # Concatenate `arr` with `med_chunk`, extended along `axis` by `pad_amt`
    return np.concatenate(
        (arr, med_chunk.repeat(pad_amt, axis).astype(arr.dtype)), axis=axis)


def _prepend_min(arr, pad_amt, num, axis=-1):
    """
    Prepend `pad_amt` minimum values along `axis`.

    Parameters
    ----------
    arr : ndarray
        Input array of arbitrary shape.
    pad_amt : int
        Amount of padding to prepend.
    num : int
        Depth into `arr` along `axis` to calculate minimum.
        Range: [1, `arr.shape[axis]`] or None (entire axis)
    axis : int
        Axis along which to pad `arr`.

    Returns
    -------
    padarr : ndarray
        Output array, with `pad_amt` values prepended along `axis`. The
        prepended region is the minimum of the first `num` values along
        `axis`.

    """
    if pad_amt == 0:
        return arr

    # Equivalent to edge padding for single value, so do that instead
    if num == 1:
        return _prepend_edge(arr, pad_amt, axis)

    # Use entire array if `num` is too large
    if num is not None:
        if num >= arr.shape[axis]:
            num = None

    # Slice a chunk from the edge to calculate stats on
    min_slice = tuple(slice(None) if i != axis else slice(num)
                      for (i, x) in enumerate(arr.shape))

    # Shape to restore singleton dimension after slicing
    pad_singleton = tuple(x if i != axis else 1
                          for (i, x) in enumerate(arr.shape))

    # Extract slice, calculate min, reshape to add singleton dimension back
    min_chunk = arr[min_slice].min(axis=axis).reshape(pad_singleton)

    # Concatenate `arr` with `min_chunk`, extended along `axis` by `pad_amt`
    return np.concatenate((min_chunk.repeat(pad_amt, axis=axis), arr),
                          axis=axis)


def _append_min(arr, pad_amt, num, axis=-1):
    """
    Append `pad_amt` median values along `axis`.

    Parameters
    ----------
    arr : ndarray
        Input array of arbitrary shape.
    pad_amt : int
        Amount of padding to append.
    num : int
        Depth into `arr` along `axis` to calculate minimum.
        Range: [1, `arr.shape[axis]`] or None (entire axis)
    axis : int
        Axis along which to pad `arr`.

    Returns
    -------
    padarr : ndarray
        Output array, with `pad_amt` values appended along `axis`. The
        appended region is the minimum of the final `num` values along `axis`.

    """
    if pad_amt == 0:
        return arr

    # Equivalent to edge padding for single value, so do that instead
    if num == 1:
        return _append_edge(arr, pad_amt, axis)

    # Use entire array if `num` is too large
    if num is not None:
        if num >= arr.shape[axis]:
            num = None

    # Slice a chunk from the edge to calculate stats on
    end = arr.shape[axis] - 1
    if num is not None:
        min_slice = tuple(
            slice(None) if i != axis else slice(end, end - num, -1)
            for (i, x) in enumerate(arr.shape))
    else:
        min_slice = tuple(slice(None) for x in arr.shape)

    # Shape to restore singleton dimension after slicing
    pad_singleton = tuple(x if i != axis else 1
                          for (i, x) in enumerate(arr.shape))

    # Extract slice, calculate min, reshape to add singleton dimension back
    min_chunk = arr[min_slice].min(axis=axis).reshape(pad_singleton)

    # Concatenate `arr` with `min_chunk`, extended along `axis` by `pad_amt`
    return np.concatenate((arr, min_chunk.repeat(pad_amt, axis=axis)),
                          axis=axis)


def _pad_ref(arr, pad_amt, method, axis=-1):
    """
    Pad `axis` of `arr` by reflection.

    Parameters
    ----------
    arr : ndarray
        Input array of arbitrary shape.
    pad_amt : tuple of ints, length 2
        Padding to (prepend, append) along `axis`.
    method : str
        Controls method of reflection; options are 'even' or 'odd'.
    axis : int
        Axis along which to pad `arr`.

    Returns
    -------
    padarr : ndarray
        Output array, with `pad_amt[0]` values prepended and `pad_amt[1]`
        values appended along `axis`. Both regions are padded with reflected
        values from the original array.

    Notes
    -----
    This algorithm does not pad with repetition, i.e. the edges are not
    repeated in the reflection. For that behavior, use `mode='symmetric'`.

    The modes 'reflect', 'symmetric', and 'wrap' must be padded with a
    single function, lest the indexing tricks in non-integer multiples of the
    original shape would violate repetition in the final iteration.

    """
    # Implicit booleanness to test for zero (or None) in any scalar type
    if pad_amt[0] == 0 and pad_amt[1] == 0:
        return arr

    ##########################################################################
    # Prepended region

    # Slice off a reverse indexed chunk from near edge to pad `arr` before
    ref_slice = tuple(slice(None) if i != axis else slice(pad_amt[0], 0, -1)
                      for (i, x) in enumerate(arr.shape))

    ref_chunk1 = arr[ref_slice]

    # Shape to restore singleton dimension after slicing
    pad_singleton = tuple(x if i != axis else 1
                          for (i, x) in enumerate(arr.shape))
    if pad_amt[0] == 1:
        ref_chunk1 = ref_chunk1.reshape(pad_singleton)

    # Memory/computationally more expensive, only do this if `method='odd'`
    if 'odd' in method and pad_amt[0] > 0:
        edge_slice1 = tuple(slice(None) if i != axis else 0
                            for (i, x) in enumerate(arr.shape))
        edge_chunk = arr[edge_slice1].reshape(pad_singleton)
        ref_chunk1 = 2 * edge_chunk - ref_chunk1
        del edge_chunk

    ##########################################################################
    # Appended region

    # Slice off a reverse indexed chunk from far edge to pad `arr` after
    start = arr.shape[axis] - pad_amt[1] - 1
    end = arr.shape[axis] - 1
    ref_slice = tuple(slice(None) if i != axis else slice(start, end)
                      for (i, x) in enumerate(arr.shape))
    rev_idx = tuple(slice(None) if i != axis else slice(None, None, -1)
                    for (i, x) in enumerate(arr.shape))
    ref_chunk2 = arr[ref_slice][rev_idx]

    if pad_amt[1] == 1:
        ref_chunk2 = ref_chunk2.reshape(pad_singleton)

    if 'odd' in method:
        edge_slice2 = tuple(slice(None) if i != axis else -1
                            for (i, x) in enumerate(arr.shape))
        edge_chunk = arr[edge_slice2].reshape(pad_singleton)
        ref_chunk2 = 2 * edge_chunk - ref_chunk2
        del edge_chunk

    # Concatenate `arr` with both chunks, extending along `axis`
    return np.concatenate((ref_chunk1, arr, ref_chunk2), axis=axis)


def _pad_sym(arr, pad_amt, method, axis=-1):
    """
    Pad `axis` of `arr` by symmetry.

    Parameters
    ----------
    arr : ndarray
        Input array of arbitrary shape.
    pad_amt : tuple of ints, length 2
        Padding to (prepend, append) along `axis`.
    method : str
        Controls method of symmetry; options are 'even' or 'odd'.
    axis : int
        Axis along which to pad `arr`.

    Returns
    -------
    padarr : ndarray
        Output array, with `pad_amt[0]` values prepended and `pad_amt[1]`
        values appended along `axis`. Both regions are padded with symmetric
        values from the original array.

    Notes
    -----
    This algorithm DOES pad with repetition, i.e. the edges are repeated.
    For padding without repeated edges, use `mode='reflect'`.

    The modes 'reflect', 'symmetric', and 'wrap' must be padded with a
    single function, lest the indexing tricks in non-integer multiples of the
    original shape would violate repetition in the final iteration.

    """
    # Implicit booleanness to test for zero (or None) in any scalar type
    if pad_amt[0] == 0 and pad_amt[1] == 0:
        return arr

    ##########################################################################
    # Prepended region

    # Slice off a reverse indexed chunk from near edge to pad `arr` before
    sym_slice = tuple(slice(None) if i != axis else slice(0, pad_amt[0])
                      for (i, x) in enumerate(arr.shape))
    rev_idx = tuple(slice(None) if i != axis else slice(None, None, -1)
                    for (i, x) in enumerate(arr.shape))
    sym_chunk1 = arr[sym_slice][rev_idx]

    # Shape to restore singleton dimension after slicing
    pad_singleton = tuple(x if i != axis else 1
                          for (i, x) in enumerate(arr.shape))
    if pad_amt[0] == 1:
        sym_chunk1 = sym_chunk1.reshape(pad_singleton)

    # Memory/computationally more expensive, only do this if `method='odd'`
    if 'odd' in method and pad_amt[0] > 0:
        edge_slice1 = tuple(slice(None) if i != axis else 0
                            for (i, x) in enumerate(arr.shape))
        edge_chunk = arr[edge_slice1].reshape(pad_singleton)
        sym_chunk1 = 2 * edge_chunk - sym_chunk1
        del edge_chunk

    ##########################################################################
    # Appended region

    # Slice off a reverse indexed chunk from far edge to pad `arr` after
    start = arr.shape[axis] - pad_amt[1]
    end = arr.shape[axis]
    sym_slice = tuple(slice(None) if i != axis else slice(start, end)
                      for (i, x) in enumerate(arr.shape))
    sym_chunk2 = arr[sym_slice][rev_idx]

    if pad_amt[1] == 1:
        sym_chunk2 = sym_chunk2.reshape(pad_singleton)

    if 'odd' in method:
        edge_slice2 = tuple(slice(None) if i != axis else -1
                            for (i, x) in enumerate(arr.shape))
        edge_chunk = arr[edge_slice2].reshape(pad_singleton)
        sym_chunk2 = 2 * edge_chunk - sym_chunk2
        del edge_chunk

    # Concatenate `arr` with both chunks, extending along `axis`
    return np.concatenate((sym_chunk1, arr, sym_chunk2), axis=axis)


def _pad_wrap(arr, pad_amt, axis=-1):
    """
    Pad `axis` of `arr` via wrapping.

    Parameters
    ----------
    arr : ndarray
        Input array of arbitrary shape.
    pad_amt : tuple of ints, length 2
        Padding to (prepend, append) along `axis`.
    axis : int
        Axis along which to pad `arr`.

    Returns
    -------
    padarr : ndarray
        Output array, with `pad_amt[0]` values prepended and `pad_amt[1]`
        values appended along `axis`. Both regions are padded wrapped values
        from the opposite end of `axis`.

    Notes
    -----
    This method of padding is also known as 'tile' or 'tiling'.

    The modes 'reflect', 'symmetric', and 'wrap' must be padded with a
    single function, lest the indexing tricks in non-integer multiples of the
    original shape would violate repetition in the final iteration.

    """
    # Implicit booleanness to test for zero (or None) in any scalar type
    if pad_amt[0] == 0 and pad_amt[1] == 0:
        return arr

    ##########################################################################
    # Prepended region

    # Slice off a reverse indexed chunk from near edge to pad `arr` before
    start = arr.shape[axis] - pad_amt[0]
    end = arr.shape[axis]
    wrap_slice = tuple(slice(None) if i != axis else slice(start, end)
                       for (i, x) in enumerate(arr.shape))
    wrap_chunk1 = arr[wrap_slice]

    # Shape to restore singleton dimension after slicing
    pad_singleton = tuple(x if i != axis else 1
                          for (i, x) in enumerate(arr.shape))
    if pad_amt[0] == 1:
        wrap_chunk1 = wrap_chunk1.reshape(pad_singleton)

    ##########################################################################
    # Appended region

    # Slice off a reverse indexed chunk from far edge to pad `arr` after
    wrap_slice = tuple(slice(None) if i != axis else slice(0, pad_amt[1])
                       for (i, x) in enumerate(arr.shape))
    wrap_chunk2 = arr[wrap_slice]

    if pad_amt[1] == 1:
        wrap_chunk2 = wrap_chunk2.reshape(pad_singleton)

    # Concatenate `arr` with both chunks, extending along `axis`
    return np.concatenate((wrap_chunk1, arr, wrap_chunk2), axis=axis)


def _normalize_shape(ndarray, shape, cast_to_int=True):
    """
    Private function which does some checks and normalizes the possibly
    much simpler representations of 'pad_width', 'stat_length',
    'constant_values', 'end_values'.

    Parameters
    ----------
    narray : ndarray
        Input ndarray
    shape : {sequence, array_like, float, int}, optional
        The width of padding (pad_width), the number of elements on the
        edge of the narray used for statistics (stat_length), the constant
        value(s) to use when filling padded regions (constant_values), or the
        endpoint target(s) for linear ramps (end_values).
        ((before_1, after_1), ... (before_N, after_N)) unique number of
        elements for each axis where `N` is rank of `narray`.
        ((before, after),) yields same before and after constants for each
        axis.
        (constant,) or val is a shortcut for before = after = constant for
        all axes.
    cast_to_int : bool, optional
        Controls if values in ``shape`` will be rounded and cast to int
        before being returned.

    Returns
    -------
    normalized_shape : tuple of tuples
        val                               => ((val, val), (val, val), ...)
        [[val1, val2], [val3, val4], ...] => ((val1, val2), (val3, val4), ...)
        ((val1, val2), (val3, val4), ...) => no change
        [[val1, val2], ]                  => ((val1, val2), (val1, val2), ...)
        ((val1, val2), )                  => ((val1, val2), (val1, val2), ...)
        [[val ,     ], ]                  => ((val, val), (val, val), ...)
        ((val ,     ), )                  => ((val, val), (val, val), ...)

    """
    ndims = ndarray.ndim

    # Shortcut shape=None
    if shape is None:
        return ((None, None), ) * ndims

    # Convert any input `info` to a NumPy array
    shape_arr = np.asarray(shape)

    try:
        shape_arr = np.broadcast_to(shape_arr, (ndims, 2))
    except ValueError:
        fmt = "Unable to create correctly shaped tuple from %s"
        raise ValueError(fmt % (shape,))

    # Cast if necessary
    if cast_to_int is True:
        shape_arr = np.round(shape_arr).astype(int)

    # Convert list of lists to tuple of tuples
    return tuple(tuple(axis) for axis in shape_arr.tolist())


def _validate_lengths(narray, number_elements):
    """
    Private function which does some checks and reformats pad_width and
    stat_length using _normalize_shape.

    Parameters
    ----------
    narray : ndarray
        Input ndarray
    number_elements : {sequence, int}, optional
        The width of padding (pad_width) or the number of elements on the edge
        of the narray used for statistics (stat_length).
        ((before_1, after_1), ... (before_N, after_N)) unique number of
        elements for each axis.
        ((before, after),) yields same before and after constants for each
        axis.
        (constant,) or int is a shortcut for before = after = constant for all
        axes.

    Returns
    -------
    _validate_lengths : tuple of tuples
        int                               => ((int, int), (int, int), ...)
        [[int1, int2], [int3, int4], ...] => ((int1, int2), (int3, int4), ...)
        ((int1, int2), (int3, int4), ...) => no change
        [[int1, int2], ]                  => ((int1, int2), (int1, int2), ...)
        ((int1, int2), )                  => ((int1, int2), (int1, int2), ...)
        [[int ,     ], ]                  => ((int, int), (int, int), ...)
        ((int ,     ), )                  => ((int, int), (int, int), ...)

    """
    normshp = _normalize_shape(narray, number_elements)
    for i in normshp:
        chk = [1 if x is None else x for x in i]
        chk = [1 if x >= 0 else -1 for x in chk]
        if (chk[0] < 0) or (chk[1] < 0):
            fmt = "%s cannot contain negative values."
            raise ValueError(fmt % (number_elements,))
    return normshp


###############################################################################
# Public functions


def pad(array, pad_width, mode, **kwargs):
    """
    Pads an array.

    Parameters
    ----------
    array : array_like of rank N
        Input array
    pad_width : {sequence, array_like, int}
        Number of values padded to the edges of each axis.
        ((before_1, after_1), ... (before_N, after_N)) unique pad widths
        for each axis.
        ((before, after),) yields same before and after pad for each axis.
        (pad,) or int is a shortcut for before = after = pad width for all
        axes.
    mode : str or function
        One of the following string values or a user supplied function.

        'constant'
            Pads with a constant value.
        'edge'
            Pads with the edge values of array.
        'linear_ramp'
            Pads with the linear ramp between end_value and the
            array edge value.
        'maximum'
            Pads with the maximum value of all or part of the
            vector along each axis.
        'mean'
            Pads with the mean value of all or part of the
            vector along each axis.
        'median'
            Pads with the median value of all or part of the
            vector along each axis.
        'minimum'
            Pads with the minimum value of all or part of the
            vector along each axis.
        'reflect'
            Pads with the reflection of the vector mirrored on
            the first and last values of the vector along each
            axis.
        'symmetric'
            Pads with the reflection of the vector mirrored
            along the edge of the array.
        'wrap'
            Pads with the wrap of the vector along the axis.
            The first values are used to pad the end and the
            end values are used to pad the beginning.
        <function>
            Padding function, see Notes.
    stat_length : sequence or int, optional
        Used in 'maximum', 'mean', 'median', and 'minimum'.  Number of
        values at edge of each axis used to calculate the statistic value.

        ((before_1, after_1), ... (before_N, after_N)) unique statistic
        lengths for each axis.

        ((before, after),) yields same before and after statistic lengths
        for each axis.

        (stat_length,) or int is a shortcut for before = after = statistic
        length for all axes.

        Default is ``None``, to use the entire axis.
    constant_values : sequence or int, optional
        Used in 'constant'.  The values to set the padded values for each
        axis.

        ((before_1, after_1), ... (before_N, after_N)) unique pad constants
        for each axis.

        ((before, after),) yields same before and after constants for each
        axis.

        (constant,) or int is a shortcut for before = after = constant for
        all axes.

        Default is 0.
    end_values : sequence or int, optional
        Used in 'linear_ramp'.  The values used for the ending value of the
        linear_ramp and that will form the edge of the padded array.

        ((before_1, after_1), ... (before_N, after_N)) unique end values
        for each axis.

        ((before, after),) yields same before and after end values for each
        axis.

        (constant,) or int is a shortcut for before = after = end value for
        all axes.

        Default is 0.
    reflect_type : {'even', 'odd'}, optional
        Used in 'reflect', and 'symmetric'.  The 'even' style is the
        default with an unaltered reflection around the edge value.  For
        the 'odd' style, the extented part of the array is created by
        subtracting the reflected values from two times the edge value.

    Returns
    -------
    pad : ndarray
        Padded array of rank equal to `array` with shape increased
        according to `pad_width`.

    Notes
    -----
    .. versionadded:: 1.7.0

    For an array with rank greater than 1, some of the padding of later
    axes is calculated from padding of previous axes.  This is easiest to
    think about with a rank 2 array where the corners of the padded array
    are calculated by using padded values from the first axis.

    The padding function, if used, should return a rank 1 array equal in
    length to the vector argument with padded values replaced. It has the
    following signature::

        padding_func(vector, iaxis_pad_width, iaxis, **kwargs)

    where

        vector : ndarray
            A rank 1 array already padded with zeros.  Padded values are
            vector[:pad_tuple[0]] and vector[-pad_tuple[1]:].
        iaxis_pad_width : tuple
            A 2-tuple of ints, iaxis_pad_width[0] represents the number of
            values padded at the beginning of vector where
            iaxis_pad_width[1] represents the number of values padded at
            the end of vector.
        iaxis : int
            The axis currently being calculated.
        kwargs : misc
            Any keyword arguments the function requires.

    Examples
    --------
    >>> a = [1, 2, 3, 4, 5]
    >>> np.lib.pad(a, (2,3), 'constant', constant_values=(4, 6))
    array([4, 4, 1, 2, 3, 4, 5, 6, 6, 6])

    >>> np.lib.pad(a, (2, 3), 'edge')
    array([1, 1, 1, 2, 3, 4, 5, 5, 5, 5])

    >>> np.lib.pad(a, (2, 3), 'linear_ramp', end_values=(5, -4))
    array([ 5,  3,  1,  2,  3,  4,  5,  2, -1, -4])

    >>> np.lib.pad(a, (2,), 'maximum')
    array([5, 5, 1, 2, 3, 4, 5, 5, 5])

    >>> np.lib.pad(a, (2,), 'mean')
    array([3, 3, 1, 2, 3, 4, 5, 3, 3])

    >>> np.lib.pad(a, (2,), 'median')
    array([3, 3, 1, 2, 3, 4, 5, 3, 3])

    >>> a = [[1, 2], [3, 4]]
    >>> np.lib.pad(a, ((3, 2), (2, 3)), 'minimum')
    array([[1, 1, 1, 2, 1, 1, 1],
           [1, 1, 1, 2, 1, 1, 1],
           [1, 1, 1, 2, 1, 1, 1],
           [1, 1, 1, 2, 1, 1, 1],
           [3, 3, 3, 4, 3, 3, 3],
           [1, 1, 1, 2, 1, 1, 1],
           [1, 1, 1, 2, 1, 1, 1]])

    >>> a = [1, 2, 3, 4, 5]
    >>> np.lib.pad(a, (2, 3), 'reflect')
    array([3, 2, 1, 2, 3, 4, 5, 4, 3, 2])

    >>> np.lib.pad(a, (2, 3), 'reflect', reflect_type='odd')
    array([-1,  0,  1,  2,  3,  4,  5,  6,  7,  8])

    >>> np.lib.pad(a, (2, 3), 'symmetric')
    array([2, 1, 1, 2, 3, 4, 5, 5, 4, 3])

    >>> np.lib.pad(a, (2, 3), 'symmetric', reflect_type='odd')
    array([0, 1, 1, 2, 3, 4, 5, 5, 6, 7])

    >>> np.lib.pad(a, (2, 3), 'wrap')
    array([4, 5, 1, 2, 3, 4, 5, 1, 2, 3])

    >>> def padwithtens(vector, pad_width, iaxis, kwargs):
    ...     vector[:pad_width[0]] = 10
    ...     vector[-pad_width[1]:] = 10
    ...     return vector

    >>> a = np.arange(6)
    >>> a = a.reshape((2, 3))

    >>> np.lib.pad(a, 2, padwithtens)
    array([[10, 10, 10, 10, 10, 10, 10],
           [10, 10, 10, 10, 10, 10, 10],
           [10, 10,  0,  1,  2, 10, 10],
           [10, 10,  3,  4,  5, 10, 10],
           [10, 10, 10, 10, 10, 10, 10],
           [10, 10, 10, 10, 10, 10, 10]])
    """
    if not np.asarray(pad_width).dtype.kind == 'i':
        raise TypeError('`pad_width` must be of integral type.')

    narray = np.array(array)
    pad_width = _validate_lengths(narray, pad_width)

    allowedkwargs = {
        'constant': ['constant_values'],
        'edge': [],
        'linear_ramp': ['end_values'],
        'maximum': ['stat_length'],
        'mean': ['stat_length'],
        'median': ['stat_length'],
        'minimum': ['stat_length'],
        'reflect': ['reflect_type'],
        'symmetric': ['reflect_type'],
        'wrap': [],
        }

    kwdefaults = {
        'stat_length': None,
        'constant_values': 0,
        'end_values': 0,
        'reflect_type': 'even',
        }

    if isinstance(mode, np.compat.basestring):
        # Make sure have allowed kwargs appropriate for mode
        for key in kwargs:
            if key not in allowedkwargs[mode]:
                raise ValueError('%s keyword not in allowed keywords %s' %
                                 (key, allowedkwargs[mode]))

        # Set kwarg defaults
        for kw in allowedkwargs[mode]:
            kwargs.setdefault(kw, kwdefaults[kw])

        # Need to only normalize particular keywords.
        for i in kwargs:
            if i == 'stat_length':
                kwargs[i] = _validate_lengths(narray, kwargs[i])
            if i in ['end_values', 'constant_values']:
                kwargs[i] = _normalize_shape(narray, kwargs[i],
                                             cast_to_int=False)
    else:
        # Drop back to old, slower np.apply_along_axis mode for user-supplied
        # vector function
        function = mode

        # Create a new padded array
        rank = list(range(narray.ndim))
        total_dim_increase = [np.sum(pad_width[i]) for i in rank]
        offset_slices = [slice(pad_width[i][0],
                               pad_width[i][0] + narray.shape[i])
                         for i in rank]
        new_shape = np.array(narray.shape) + total_dim_increase
        newmat = np.zeros(new_shape, narray.dtype)

        # Insert the original array into the padded array
        newmat[offset_slices] = narray

        # This is the core of pad ...
        for iaxis in rank:
            np.apply_along_axis(function,
                                iaxis,
                                newmat,
                                pad_width[iaxis],
                                iaxis,
                                kwargs)
        return newmat

    # If we get here, use new padding method
    newmat = narray.copy()

    # API preserved, but completely new algorithm which pads by building the
    # entire block to pad before/after `arr` with in one step, for each axis.
    if mode == 'constant':
        for axis, ((pad_before, pad_after), (before_val, after_val)) \
                in enumerate(zip(pad_width, kwargs['constant_values'])):
            newmat = _prepend_const(newmat, pad_before, before_val, axis)
            newmat = _append_const(newmat, pad_after, after_val, axis)

    elif mode == 'edge':
        for axis, (pad_before, pad_after) in enumerate(pad_width):
            newmat = _prepend_edge(newmat, pad_before, axis)
            newmat = _append_edge(newmat, pad_after, axis)

    elif mode == 'linear_ramp':
        for axis, ((pad_before, pad_after), (before_val, after_val)) \
                in enumerate(zip(pad_width, kwargs['end_values'])):
            newmat = _prepend_ramp(newmat, pad_before, before_val, axis)
            newmat = _append_ramp(newmat, pad_after, after_val, axis)

    elif mode == 'maximum':
        for axis, ((pad_before, pad_after), (chunk_before, chunk_after)) \
                in enumerate(zip(pad_width, kwargs['stat_length'])):
            newmat = _prepend_max(newmat, pad_before, chunk_before, axis)
            newmat = _append_max(newmat, pad_after, chunk_after, axis)

    elif mode == 'mean':
        for axis, ((pad_before, pad_after), (chunk_before, chunk_after)) \
                in enumerate(zip(pad_width, kwargs['stat_length'])):
            newmat = _prepend_mean(newmat, pad_before, chunk_before, axis)
            newmat = _append_mean(newmat, pad_after, chunk_after, axis)

    elif mode == 'median':
        for axis, ((pad_before, pad_after), (chunk_before, chunk_after)) \
                in enumerate(zip(pad_width, kwargs['stat_length'])):
            newmat = _prepend_med(newmat, pad_before, chunk_before, axis)
            newmat = _append_med(newmat, pad_after, chunk_after, axis)

    elif mode == 'minimum':
        for axis, ((pad_before, pad_after), (chunk_before, chunk_after)) \
                in enumerate(zip(pad_width, kwargs['stat_length'])):
            newmat = _prepend_min(newmat, pad_before, chunk_before, axis)
            newmat = _append_min(newmat, pad_after, chunk_after, axis)

    elif mode == 'reflect':
        for axis, (pad_before, pad_after) in enumerate(pad_width):
            # Recursive padding along any axis where `pad_amt` is too large
            # for indexing tricks. We can only safely pad the original axis
            # length, to keep the period of the reflections consistent.
            if ((pad_before > 0) or
                    (pad_after > 0)) and newmat.shape[axis] == 1:
                # Extending singleton dimension for 'reflect' is legacy
                # behavior; it really should raise an error.
                newmat = _prepend_edge(newmat, pad_before, axis)
                newmat = _append_edge(newmat, pad_after, axis)
                continue

            method = kwargs['reflect_type']
            safe_pad = newmat.shape[axis] - 1
            while ((pad_before > safe_pad) or (pad_after > safe_pad)):
                pad_iter_b = min(safe_pad,
                                 safe_pad * (pad_before // safe_pad))
                pad_iter_a = min(safe_pad, safe_pad * (pad_after // safe_pad))
                newmat = _pad_ref(newmat, (pad_iter_b,
                                           pad_iter_a), method, axis)
                pad_before -= pad_iter_b
                pad_after -= pad_iter_a
                safe_pad += pad_iter_b + pad_iter_a
            newmat = _pad_ref(newmat, (pad_before, pad_after), method, axis)

    elif mode == 'symmetric':
        for axis, (pad_before, pad_after) in enumerate(pad_width):
            # Recursive padding along any axis where `pad_amt` is too large
            # for indexing tricks. We can only safely pad the original axis
            # length, to keep the period of the reflections consistent.
            method = kwargs['reflect_type']
            safe_pad = newmat.shape[axis]
            while ((pad_before > safe_pad) or
                   (pad_after > safe_pad)):
                pad_iter_b = min(safe_pad,
                                 safe_pad * (pad_before // safe_pad))
                pad_iter_a = min(safe_pad, safe_pad * (pad_after // safe_pad))
                newmat = _pad_sym(newmat, (pad_iter_b,
                                           pad_iter_a), method, axis)
                pad_before -= pad_iter_b
                pad_after -= pad_iter_a
                safe_pad += pad_iter_b + pad_iter_a
            newmat = _pad_sym(newmat, (pad_before, pad_after), method, axis)

    elif mode == 'wrap':
        for axis, (pad_before, pad_after) in enumerate(pad_width):
            # Recursive padding along any axis where `pad_amt` is too large
            # for indexing tricks. We can only safely pad the original axis
            # length, to keep the period of the reflections consistent.
            safe_pad = newmat.shape[axis]
            while ((pad_before > safe_pad) or
                   (pad_after > safe_pad)):
                pad_iter_b = min(safe_pad,
                                 safe_pad * (pad_before // safe_pad))
                pad_iter_a = min(safe_pad, safe_pad * (pad_after // safe_pad))
                newmat = _pad_wrap(newmat, (pad_iter_b, pad_iter_a), axis)

                pad_before -= pad_iter_b
                pad_after -= pad_iter_a
                safe_pad += pad_iter_b + pad_iter_a
            newmat = _pad_wrap(newmat, (pad_before, pad_after), axis)

    return newmat
