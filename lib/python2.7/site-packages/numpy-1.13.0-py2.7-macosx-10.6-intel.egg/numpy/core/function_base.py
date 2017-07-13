from __future__ import division, absolute_import, print_function

import warnings
import operator

from . import numeric as _nx
from .numeric import (result_type, NaN, shares_memory, MAY_SHARE_BOUNDS,
                      TooHardError,asanyarray)

__all__ = ['logspace', 'linspace', 'geomspace']


def _index_deprecate(i, stacklevel=2):
    try:
        i = operator.index(i)
    except TypeError:
        msg = ("object of type {} cannot be safely interpreted as "
               "an integer.".format(type(i)))
        i = int(i)
        stacklevel += 1
        warnings.warn(msg, DeprecationWarning, stacklevel=stacklevel)
    return i


def linspace(start, stop, num=50, endpoint=True, retstep=False, dtype=None):
    """
    Return evenly spaced numbers over a specified interval.

    Returns `num` evenly spaced samples, calculated over the
    interval [`start`, `stop`].

    The endpoint of the interval can optionally be excluded.

    Parameters
    ----------
    start : scalar
        The starting value of the sequence.
    stop : scalar
        The end value of the sequence, unless `endpoint` is set to False.
        In that case, the sequence consists of all but the last of ``num + 1``
        evenly spaced samples, so that `stop` is excluded.  Note that the step
        size changes when `endpoint` is False.
    num : int, optional
        Number of samples to generate. Default is 50. Must be non-negative.
    endpoint : bool, optional
        If True, `stop` is the last sample. Otherwise, it is not included.
        Default is True.
    retstep : bool, optional
        If True, return (`samples`, `step`), where `step` is the spacing
        between samples.
    dtype : dtype, optional
        The type of the output array.  If `dtype` is not given, infer the data
        type from the other input arguments.

        .. versionadded:: 1.9.0

    Returns
    -------
    samples : ndarray
        There are `num` equally spaced samples in the closed interval
        ``[start, stop]`` or the half-open interval ``[start, stop)``
        (depending on whether `endpoint` is True or False).
    step : float, optional
        Only returned if `retstep` is True

        Size of spacing between samples.


    See Also
    --------
    arange : Similar to `linspace`, but uses a step size (instead of the
             number of samples).
    logspace : Samples uniformly distributed in log space.

    Examples
    --------
    >>> np.linspace(2.0, 3.0, num=5)
    array([ 2.  ,  2.25,  2.5 ,  2.75,  3.  ])
    >>> np.linspace(2.0, 3.0, num=5, endpoint=False)
    array([ 2. ,  2.2,  2.4,  2.6,  2.8])
    >>> np.linspace(2.0, 3.0, num=5, retstep=True)
    (array([ 2.  ,  2.25,  2.5 ,  2.75,  3.  ]), 0.25)

    Graphical illustration:

    >>> import matplotlib.pyplot as plt
    >>> N = 8
    >>> y = np.zeros(N)
    >>> x1 = np.linspace(0, 10, N, endpoint=True)
    >>> x2 = np.linspace(0, 10, N, endpoint=False)
    >>> plt.plot(x1, y, 'o')
    [<matplotlib.lines.Line2D object at 0x...>]
    >>> plt.plot(x2, y + 0.5, 'o')
    [<matplotlib.lines.Line2D object at 0x...>]
    >>> plt.ylim([-0.5, 1])
    (-0.5, 1)
    >>> plt.show()

    """
    # 2016-02-25, 1.12
    num = _index_deprecate(num)
    if num < 0:
        raise ValueError("Number of samples, %s, must be non-negative." % num)
    div = (num - 1) if endpoint else num

    # Convert float/complex array scalars to float, gh-3504
    # and make sure one can use variables that have an __array_interface__, gh-6634
    start = asanyarray(start) * 1.0
    stop  = asanyarray(stop)  * 1.0

    dt = result_type(start, stop, float(num))
    if dtype is None:
        dtype = dt

    y = _nx.arange(0, num, dtype=dt)

    delta = stop - start
    if num > 1:
        step = delta / div
        if step == 0:
            # Special handling for denormal numbers, gh-5437
            y /= div
            y = y * delta
        else:
            # One might be tempted to use faster, in-place multiplication here,
            # but this prevents step from overriding what class is produced,
            # and thus prevents, e.g., use of Quantities; see gh-7142.
            y = y * step
    else:
        # 0 and 1 item long sequences have an undefined step
        step = NaN
        # Multiply with delta to allow possible override of output class.
        y = y * delta

    y += start

    if endpoint and num > 1:
        y[-1] = stop

    if retstep:
        return y.astype(dtype, copy=False), step
    else:
        return y.astype(dtype, copy=False)


def logspace(start, stop, num=50, endpoint=True, base=10.0, dtype=None):
    """
    Return numbers spaced evenly on a log scale.

    In linear space, the sequence starts at ``base ** start``
    (`base` to the power of `start`) and ends with ``base ** stop``
    (see `endpoint` below).

    Parameters
    ----------
    start : float
        ``base ** start`` is the starting value of the sequence.
    stop : float
        ``base ** stop`` is the final value of the sequence, unless `endpoint`
        is False.  In that case, ``num + 1`` values are spaced over the
        interval in log-space, of which all but the last (a sequence of
        length `num`) are returned.
    num : integer, optional
        Number of samples to generate.  Default is 50.
    endpoint : boolean, optional
        If true, `stop` is the last sample. Otherwise, it is not included.
        Default is True.
    base : float, optional
        The base of the log space. The step size between the elements in
        ``ln(samples) / ln(base)`` (or ``log_base(samples)``) is uniform.
        Default is 10.0.
    dtype : dtype
        The type of the output array.  If `dtype` is not given, infer the data
        type from the other input arguments.

    Returns
    -------
    samples : ndarray
        `num` samples, equally spaced on a log scale.

    See Also
    --------
    arange : Similar to linspace, with the step size specified instead of the
             number of samples. Note that, when used with a float endpoint, the
             endpoint may or may not be included.
    linspace : Similar to logspace, but with the samples uniformly distributed
               in linear space, instead of log space.
    geomspace : Similar to logspace, but with endpoints specified directly.

    Notes
    -----
    Logspace is equivalent to the code

    >>> y = np.linspace(start, stop, num=num, endpoint=endpoint)
    ... # doctest: +SKIP
    >>> power(base, y).astype(dtype)
    ... # doctest: +SKIP

    Examples
    --------
    >>> np.logspace(2.0, 3.0, num=4)
    array([  100.        ,   215.443469  ,   464.15888336,  1000.        ])
    >>> np.logspace(2.0, 3.0, num=4, endpoint=False)
    array([ 100.        ,  177.827941  ,  316.22776602,  562.34132519])
    >>> np.logspace(2.0, 3.0, num=4, base=2.0)
    array([ 4.        ,  5.0396842 ,  6.34960421,  8.        ])

    Graphical illustration:

    >>> import matplotlib.pyplot as plt
    >>> N = 10
    >>> x1 = np.logspace(0.1, 1, N, endpoint=True)
    >>> x2 = np.logspace(0.1, 1, N, endpoint=False)
    >>> y = np.zeros(N)
    >>> plt.plot(x1, y, 'o')
    [<matplotlib.lines.Line2D object at 0x...>]
    >>> plt.plot(x2, y + 0.5, 'o')
    [<matplotlib.lines.Line2D object at 0x...>]
    >>> plt.ylim([-0.5, 1])
    (-0.5, 1)
    >>> plt.show()

    """
    y = linspace(start, stop, num=num, endpoint=endpoint)
    if dtype is None:
        return _nx.power(base, y)
    return _nx.power(base, y).astype(dtype)


def geomspace(start, stop, num=50, endpoint=True, dtype=None):
    """
    Return numbers spaced evenly on a log scale (a geometric progression).

    This is similar to `logspace`, but with endpoints specified directly.
    Each output sample is a constant multiple of the previous.

    Parameters
    ----------
    start : scalar
        The starting value of the sequence.
    stop : scalar
        The final value of the sequence, unless `endpoint` is False.
        In that case, ``num + 1`` values are spaced over the
        interval in log-space, of which all but the last (a sequence of
        length `num`) are returned.
    num : integer, optional
        Number of samples to generate.  Default is 50.
    endpoint : boolean, optional
        If true, `stop` is the last sample. Otherwise, it is not included.
        Default is True.
    dtype : dtype
        The type of the output array.  If `dtype` is not given, infer the data
        type from the other input arguments.

    Returns
    -------
    samples : ndarray
        `num` samples, equally spaced on a log scale.

    See Also
    --------
    logspace : Similar to geomspace, but with endpoints specified using log
               and base.
    linspace : Similar to geomspace, but with arithmetic instead of geometric
               progression.
    arange : Similar to linspace, with the step size specified instead of the
             number of samples.

    Notes
    -----
    If the inputs or dtype are complex, the output will follow a logarithmic
    spiral in the complex plane.  (There are an infinite number of spirals
    passing through two points; the output will follow the shortest such path.)

    Examples
    --------
    >>> np.geomspace(1, 1000, num=4)
    array([    1.,    10.,   100.,  1000.])
    >>> np.geomspace(1, 1000, num=3, endpoint=False)
    array([   1.,   10.,  100.])
    >>> np.geomspace(1, 1000, num=4, endpoint=False)
    array([   1.        ,    5.62341325,   31.6227766 ,  177.827941  ])
    >>> np.geomspace(1, 256, num=9)
    array([   1.,    2.,    4.,    8.,   16.,   32.,   64.,  128.,  256.])

    Note that the above may not produce exact integers:

    >>> np.geomspace(1, 256, num=9, dtype=int)
    array([  1,   2,   4,   7,  16,  32,  63, 127, 256])
    >>> np.around(np.geomspace(1, 256, num=9)).astype(int)
    array([  1,   2,   4,   8,  16,  32,  64, 128, 256])

    Negative, decreasing, and complex inputs are allowed:

    >>> geomspace(1000, 1, num=4)
    array([ 1000.,   100.,    10.,     1.])
    >>> geomspace(-1000, -1, num=4)
    array([-1000.,  -100.,   -10.,    -1.])
    >>> geomspace(1j, 1000j, num=4)  # Straight line
    array([ 0.   +1.j,  0.  +10.j,  0. +100.j,  0.+1000.j])
    >>> geomspace(-1+0j, 1+0j, num=5)  # Circle
    array([-1.00000000+0.j        , -0.70710678+0.70710678j,
            0.00000000+1.j        ,  0.70710678+0.70710678j,
            1.00000000+0.j        ])

    Graphical illustration of ``endpoint`` parameter:

    >>> import matplotlib.pyplot as plt
    >>> N = 10
    >>> y = np.zeros(N)
    >>> plt.semilogx(np.geomspace(1, 1000, N, endpoint=True), y + 1, 'o')
    >>> plt.semilogx(np.geomspace(1, 1000, N, endpoint=False), y + 2, 'o')
    >>> plt.axis([0.5, 2000, 0, 3])
    >>> plt.grid(True, color='0.7', linestyle='-', which='both', axis='both')
    >>> plt.show()

    """
    if start == 0 or stop == 0:
        raise ValueError('Geometric sequence cannot include zero')

    dt = result_type(start, stop, float(num))
    if dtype is None:
        dtype = dt
    else:
        # complex to dtype('complex128'), for instance
        dtype = _nx.dtype(dtype)

    # Avoid negligible real or imaginary parts in output by rotating to
    # positive real, calculating, then undoing rotation
    out_sign = 1
    if start.real == stop.real == 0:
        start, stop = start.imag, stop.imag
        out_sign = 1j * out_sign
    if _nx.sign(start) == _nx.sign(stop) == -1:
        start, stop = -start, -stop
        out_sign = -out_sign

    # Promote both arguments to the same dtype in case, for instance, one is
    # complex and another is negative and log would produce NaN otherwise
    start = start + (stop - stop)
    stop = stop + (start - start)
    if _nx.issubdtype(dtype, complex):
        start = start + 0j
        stop = stop + 0j

    log_start = _nx.log10(start)
    log_stop = _nx.log10(stop)
    result = out_sign * logspace(log_start, log_stop, num=num,
                                 endpoint=endpoint, base=10.0, dtype=dtype)

    return result.astype(dtype)
