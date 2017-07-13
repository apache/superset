"""
Provides rolling statistical moments and related descriptive
statistics implemented in Cython
"""
from __future__ import division

import warnings
import numpy as np
from pandas.core.dtypes.common import is_scalar
from pandas.core.api import DataFrame, Series
from pandas.util._decorators import Substitution, Appender

__all__ = ['rolling_count', 'rolling_max', 'rolling_min',
           'rolling_sum', 'rolling_mean', 'rolling_std', 'rolling_cov',
           'rolling_corr', 'rolling_var', 'rolling_skew', 'rolling_kurt',
           'rolling_quantile', 'rolling_median', 'rolling_apply',
           'rolling_window',
           'ewma', 'ewmvar', 'ewmstd', 'ewmvol', 'ewmcorr', 'ewmcov',
           'expanding_count', 'expanding_max', 'expanding_min',
           'expanding_sum', 'expanding_mean', 'expanding_std',
           'expanding_cov', 'expanding_corr', 'expanding_var',
           'expanding_skew', 'expanding_kurt', 'expanding_quantile',
           'expanding_median', 'expanding_apply']

# -----------------------------------------------------------------------------
# Docs

# The order of arguments for the _doc_template is:
# (header, args, kwargs, returns, notes)

_doc_template = """
%s

Parameters
----------
%s%s
Returns
-------
%s
%s
"""

_roll_kw = """window : int
    Size of the moving window. This is the number of observations used for
    calculating the statistic.
min_periods : int, default None
    Minimum number of observations in window required to have a value
    (otherwise result is NA).
freq : string or DateOffset object, optional (default None)
    Frequency to conform the data to before computing the statistic. Specified
    as a frequency string or DateOffset object.
center : boolean, default False
    Set the labels at the center of the window.
how : string, default '%s'
    Method for down- or re-sampling
"""

_roll_notes = r"""
Notes
-----
By default, the result is set to the right edge of the window. This can be
changed to the center of the window by setting ``center=True``.

The `freq` keyword is used to conform time series data to a specified
frequency by resampling the data. This is done with the default parameters
of :meth:`~pandas.Series.resample` (i.e. using the `mean`).
"""


_ewm_kw = r"""com : float, optional
    Specify decay in terms of center of mass,
    :math:`\alpha = 1 / (1 + com),\text{ for } com \geq 0`
span : float, optional
    Specify decay in terms of span,
    :math:`\alpha = 2 / (span + 1),\text{ for } span \geq 1`
halflife : float, optional
    Specify decay in terms of half-life,
    :math:`\alpha = 1 - exp(log(0.5) / halflife),\text{ for } halflife > 0`
alpha : float, optional
    Specify smoothing factor :math:`\alpha` directly,
    :math:`0 < \alpha \leq 1`

    .. versionadded:: 0.18.0

min_periods : int, default 0
    Minimum number of observations in window required to have a value
    (otherwise result is NA).
freq : None or string alias / date offset object, default=None
    Frequency to conform to before computing statistic
adjust : boolean, default True
    Divide by decaying adjustment factor in beginning periods to account for
    imbalance in relative weightings (viewing EWMA as a moving average)
how : string, default 'mean'
    Method for down- or re-sampling
ignore_na : boolean, default False
    Ignore missing values when calculating weights;
    specify True to reproduce pre-0.15.0 behavior
"""

_ewm_notes = r"""
Notes
-----
Exactly one of center of mass, span, half-life, and alpha must be provided.
Allowed values and relationship between the parameters are specified in the
parameter descriptions above; see the link at the end of this section for
a detailed explanation.

When adjust is True (default), weighted averages are calculated using weights
    (1-alpha)**(n-1), (1-alpha)**(n-2), ..., 1-alpha, 1.

When adjust is False, weighted averages are calculated recursively as:
    weighted_average[0] = arg[0];
    weighted_average[i] = (1-alpha)*weighted_average[i-1] + alpha*arg[i].

When ignore_na is False (default), weights are based on absolute positions.
For example, the weights of x and y used in calculating the final weighted
average of [x, None, y] are (1-alpha)**2 and 1 (if adjust is True), and
(1-alpha)**2 and alpha (if adjust is False).

When ignore_na is True (reproducing pre-0.15.0 behavior), weights are based on
relative positions. For example, the weights of x and y used in calculating
the final weighted average of [x, None, y] are 1-alpha and 1 (if adjust is
True), and 1-alpha and alpha (if adjust is False).

More details can be found at
http://pandas.pydata.org/pandas-docs/stable/computation.html#exponentially-weighted-windows
"""

_expanding_kw = """min_periods : int, default None
    Minimum number of observations in window required to have a value
    (otherwise result is NA).
freq : string or DateOffset object, optional (default None)
    Frequency to conform the data to before computing the statistic. Specified
    as a frequency string or DateOffset object.
"""


_type_of_input_retval = "y : type of input argument"

_flex_retval = """y : type depends on inputs
    DataFrame / DataFrame -> DataFrame (matches on columns) or Panel (pairwise)
    DataFrame / Series -> Computes result for each column
    Series / Series -> Series"""

_pairwise_retval = "y : Panel whose items are df1.index values"

_unary_arg = "arg : Series, DataFrame\n"

_binary_arg_flex = """arg1 : Series, DataFrame, or ndarray
arg2 : Series, DataFrame, or ndarray, optional
    if not supplied then will default to arg1 and produce pairwise output
"""

_binary_arg = """arg1 : Series, DataFrame, or ndarray
arg2 : Series, DataFrame, or ndarray
"""

_pairwise_arg = """df1 : DataFrame
df2 : DataFrame
"""

_pairwise_kw = """pairwise : bool, default False
    If False then only matching columns between arg1 and arg2 will be used and
    the output will be a DataFrame.
    If True then all pairwise combinations will be calculated and the output
    will be a Panel in the case of DataFrame inputs. In the case of missing
    elements, only complete pairwise observations will be used.
"""

_ddof_kw = """ddof : int, default 1
    Delta Degrees of Freedom.  The divisor used in calculations
    is ``N - ddof``, where ``N`` represents the number of elements.
"""

_bias_kw = r"""bias : boolean, default False
    Use a standard estimation bias correction
"""


def ensure_compat(dispatch, name, arg, func_kw=None, *args, **kwargs):
    """
    wrapper function to dispatch to the appropriate window functions
    wraps/unwraps ndarrays for compat

    can be removed when ndarray support is removed
    """
    is_ndarray = isinstance(arg, np.ndarray)
    if is_ndarray:
        if arg.ndim == 1:
            arg = Series(arg)
        elif arg.ndim == 2:
            arg = DataFrame(arg)
        else:
            raise AssertionError("cannot support ndim > 2 for ndarray compat")

        warnings.warn("pd.{dispatch}_{name} is deprecated for ndarrays and "
                      "will be removed "
                      "in a future version"
                      .format(dispatch=dispatch, name=name),
                      FutureWarning, stacklevel=3)

    # get the functional keywords here
    if func_kw is None:
        func_kw = []
    kwds = {}
    for k in func_kw:
        value = kwargs.pop(k, None)
        if value is not None:
            kwds[k] = value

    # how is a keyword that if not-None should be in kwds
    how = kwargs.pop('how', None)
    if how is not None:
        kwds['how'] = how

    r = getattr(arg, dispatch)(**kwargs)

    if not is_ndarray:

        # give a helpful deprecation message
        # with copy-pastable arguments
        pargs = ','.join(["{a}={b}".format(a=a, b=b)
                          for a, b in kwargs.items() if b is not None])
        aargs = ','.join(args)
        if len(aargs):
            aargs += ','

        def f(a, b):
            if is_scalar(b):
                return "{a}={b}".format(a=a, b=b)
            return "{a}=<{b}>".format(a=a, b=type(b).__name__)
        aargs = ','.join([f(a, b) for a, b in kwds.items() if b is not None])
        warnings.warn("pd.{dispatch}_{name} is deprecated for {klass} "
                      "and will be removed in a future version, replace with "
                      "\n\t{klass}.{dispatch}({pargs}).{name}({aargs})"
                      .format(klass=type(arg).__name__, pargs=pargs,
                              aargs=aargs, dispatch=dispatch, name=name),
                      FutureWarning, stacklevel=3)

    result = getattr(r, name)(*args, **kwds)

    if is_ndarray:
        result = result.values
    return result


def rolling_count(arg, window, **kwargs):
    """
    Rolling count of number of non-NaN observations inside provided window.

    Parameters
    ----------
    arg :  DataFrame or numpy ndarray-like
    window : int
        Size of the moving window. This is the number of observations used for
        calculating the statistic.
    freq : string or DateOffset object, optional (default None)
        Frequency to conform the data to before computing the
        statistic. Specified as a frequency string or DateOffset object.
    center : boolean, default False
        Whether the label should correspond with center of window
    how : string, default 'mean'
        Method for down- or re-sampling

    Returns
    -------
    rolling_count : type of caller

    Notes
    -----
    The `freq` keyword is used to conform time series data to a specified
    frequency by resampling the data. This is done with the default parameters
    of :meth:`~pandas.Series.resample` (i.e. using the `mean`).

    To learn more about the frequency strings, please see `this link
    <http://pandas.pydata.org/pandas-docs/stable/timeseries.html#offset-aliases>`__.
    """
    return ensure_compat('rolling', 'count', arg, window=window, **kwargs)


@Substitution("Unbiased moving covariance.", _binary_arg_flex,
              _roll_kw % 'None' + _pairwise_kw + _ddof_kw, _flex_retval,
              _roll_notes)
@Appender(_doc_template)
def rolling_cov(arg1, arg2=None, window=None, pairwise=None, **kwargs):
    if window is None and isinstance(arg2, (int, float)):
        window = arg2
        arg2 = arg1
        pairwise = True if pairwise is None else pairwise  # only default unset
    elif arg2 is None:
        arg2 = arg1
        pairwise = True if pairwise is None else pairwise  # only default unset
    return ensure_compat('rolling',
                         'cov',
                         arg1,
                         other=arg2,
                         window=window,
                         pairwise=pairwise,
                         func_kw=['other', 'pairwise', 'ddof'],
                         **kwargs)


@Substitution("Moving sample correlation.", _binary_arg_flex,
              _roll_kw % 'None' + _pairwise_kw, _flex_retval, _roll_notes)
@Appender(_doc_template)
def rolling_corr(arg1, arg2=None, window=None, pairwise=None, **kwargs):
    if window is None and isinstance(arg2, (int, float)):
        window = arg2
        arg2 = arg1
        pairwise = True if pairwise is None else pairwise  # only default unset
    elif arg2 is None:
        arg2 = arg1
        pairwise = True if pairwise is None else pairwise  # only default unset
    return ensure_compat('rolling',
                         'corr',
                         arg1,
                         other=arg2,
                         window=window,
                         pairwise=pairwise,
                         func_kw=['other', 'pairwise'],
                         **kwargs)


# -----------------------------------------------------------------------------
# Exponential moving moments


@Substitution("Exponentially-weighted moving average", _unary_arg, _ewm_kw,
              _type_of_input_retval, _ewm_notes)
@Appender(_doc_template)
def ewma(arg, com=None, span=None, halflife=None, alpha=None, min_periods=0,
         freq=None, adjust=True, how=None, ignore_na=False):
    return ensure_compat('ewm',
                         'mean',
                         arg,
                         com=com,
                         span=span,
                         halflife=halflife,
                         alpha=alpha,
                         min_periods=min_periods,
                         freq=freq,
                         adjust=adjust,
                         how=how,
                         ignore_na=ignore_na)


@Substitution("Exponentially-weighted moving variance", _unary_arg,
              _ewm_kw + _bias_kw, _type_of_input_retval, _ewm_notes)
@Appender(_doc_template)
def ewmvar(arg, com=None, span=None, halflife=None, alpha=None, min_periods=0,
           bias=False, freq=None, how=None, ignore_na=False, adjust=True):
    return ensure_compat('ewm',
                         'var',
                         arg,
                         com=com,
                         span=span,
                         halflife=halflife,
                         alpha=alpha,
                         min_periods=min_periods,
                         freq=freq,
                         adjust=adjust,
                         how=how,
                         ignore_na=ignore_na,
                         bias=bias,
                         func_kw=['bias'])


@Substitution("Exponentially-weighted moving std", _unary_arg,
              _ewm_kw + _bias_kw, _type_of_input_retval, _ewm_notes)
@Appender(_doc_template)
def ewmstd(arg, com=None, span=None, halflife=None, alpha=None, min_periods=0,
           bias=False, freq=None, how=None, ignore_na=False, adjust=True):
    return ensure_compat('ewm',
                         'std',
                         arg,
                         com=com,
                         span=span,
                         halflife=halflife,
                         alpha=alpha,
                         min_periods=min_periods,
                         freq=freq,
                         adjust=adjust,
                         how=how,
                         ignore_na=ignore_na,
                         bias=bias,
                         func_kw=['bias'])


ewmvol = ewmstd


@Substitution("Exponentially-weighted moving covariance", _binary_arg_flex,
              _ewm_kw + _pairwise_kw, _type_of_input_retval, _ewm_notes)
@Appender(_doc_template)
def ewmcov(arg1, arg2=None, com=None, span=None, halflife=None, alpha=None,
           min_periods=0, bias=False, freq=None, pairwise=None, how=None,
           ignore_na=False, adjust=True):
    if arg2 is None:
        arg2 = arg1
        pairwise = True if pairwise is None else pairwise
    elif isinstance(arg2, (int, float)) and com is None:
        com = arg2
        arg2 = arg1
        pairwise = True if pairwise is None else pairwise

    return ensure_compat('ewm',
                         'cov',
                         arg1,
                         other=arg2,
                         com=com,
                         span=span,
                         halflife=halflife,
                         alpha=alpha,
                         min_periods=min_periods,
                         bias=bias,
                         freq=freq,
                         how=how,
                         ignore_na=ignore_na,
                         adjust=adjust,
                         pairwise=pairwise,
                         func_kw=['other', 'pairwise', 'bias'])


@Substitution("Exponentially-weighted moving correlation", _binary_arg_flex,
              _ewm_kw + _pairwise_kw, _type_of_input_retval, _ewm_notes)
@Appender(_doc_template)
def ewmcorr(arg1, arg2=None, com=None, span=None, halflife=None, alpha=None,
            min_periods=0, freq=None, pairwise=None, how=None, ignore_na=False,
            adjust=True):
    if arg2 is None:
        arg2 = arg1
        pairwise = True if pairwise is None else pairwise
    elif isinstance(arg2, (int, float)) and com is None:
        com = arg2
        arg2 = arg1
        pairwise = True if pairwise is None else pairwise
    return ensure_compat('ewm',
                         'corr',
                         arg1,
                         other=arg2,
                         com=com,
                         span=span,
                         halflife=halflife,
                         alpha=alpha,
                         min_periods=min_periods,
                         freq=freq,
                         how=how,
                         ignore_na=ignore_na,
                         adjust=adjust,
                         pairwise=pairwise,
                         func_kw=['other', 'pairwise'])

# ---------------------------------------------------------------------
# Python interface to Cython functions


def _rolling_func(name, desc, how=None, func_kw=None, additional_kw=''):
    if how is None:
        how_arg_str = 'None'
    else:
        how_arg_str = "'%s" % how

    @Substitution(desc, _unary_arg, _roll_kw % how_arg_str + additional_kw,
                  _type_of_input_retval, _roll_notes)
    @Appender(_doc_template)
    def f(arg, window, min_periods=None, freq=None, center=False,
          **kwargs):

        return ensure_compat('rolling',
                             name,
                             arg,
                             window=window,
                             min_periods=min_periods,
                             freq=freq,
                             center=center,
                             func_kw=func_kw,
                             **kwargs)
    return f


rolling_max = _rolling_func('max', 'Moving maximum.', how='max')
rolling_min = _rolling_func('min', 'Moving minimum.', how='min')
rolling_sum = _rolling_func('sum', 'Moving sum.')
rolling_mean = _rolling_func('mean', 'Moving mean.')
rolling_median = _rolling_func('median', 'Moving median.', how='median')
rolling_std = _rolling_func('std', 'Moving standard deviation.',
                            func_kw=['ddof'],
                            additional_kw=_ddof_kw)
rolling_var = _rolling_func('var', 'Moving variance.',
                            func_kw=['ddof'],
                            additional_kw=_ddof_kw)
rolling_skew = _rolling_func('skew', 'Unbiased moving skewness.')
rolling_kurt = _rolling_func('kurt', 'Unbiased moving kurtosis.')


def rolling_quantile(arg, window, quantile, min_periods=None, freq=None,
                     center=False):
    """Moving quantile.

    Parameters
    ----------
    arg : Series, DataFrame
    window : int
        Size of the moving window. This is the number of observations used for
        calculating the statistic.
    quantile : float
        0 <= quantile <= 1
    min_periods : int, default None
        Minimum number of observations in window required to have a value
        (otherwise result is NA).
    freq : string or DateOffset object, optional (default None)
        Frequency to conform the data to before computing the
        statistic. Specified as a frequency string or DateOffset object.
    center : boolean, default False
        Whether the label should correspond with center of window

    Returns
    -------
    y : type of input argument

    Notes
    -----
    By default, the result is set to the right edge of the window. This can be
    changed to the center of the window by setting ``center=True``.

    The `freq` keyword is used to conform time series data to a specified
    frequency by resampling the data. This is done with the default parameters
    of :meth:`~pandas.Series.resample` (i.e. using the `mean`).

    To learn more about the frequency strings, please see `this link
    <http://pandas.pydata.org/pandas-docs/stable/timeseries.html#offset-aliases>`__.
    """
    return ensure_compat('rolling',
                         'quantile',
                         arg,
                         window=window,
                         freq=freq,
                         center=center,
                         min_periods=min_periods,
                         func_kw=['quantile'],
                         quantile=quantile)


def rolling_apply(arg, window, func, min_periods=None, freq=None,
                  center=False, args=(), kwargs={}):
    """Generic moving function application.

    Parameters
    ----------
    arg : Series, DataFrame
    window : int
        Size of the moving window. This is the number of observations used for
        calculating the statistic.
    func : function
        Must produce a single value from an ndarray input
    min_periods : int, default None
        Minimum number of observations in window required to have a value
        (otherwise result is NA).
    freq : string or DateOffset object, optional (default None)
        Frequency to conform the data to before computing the
        statistic. Specified as a frequency string or DateOffset object.
    center : boolean, default False
        Whether the label should correspond with center of window
    args : tuple
        Passed on to func
    kwargs : dict
        Passed on to func

    Returns
    -------
    y : type of input argument

    Notes
    -----
    By default, the result is set to the right edge of the window. This can be
    changed to the center of the window by setting ``center=True``.

    The `freq` keyword is used to conform time series data to a specified
    frequency by resampling the data. This is done with the default parameters
    of :meth:`~pandas.Series.resample` (i.e. using the `mean`).

    To learn more about the frequency strings, please see `this link
    <http://pandas.pydata.org/pandas-docs/stable/timeseries.html#offset-aliases>`__.
    """
    return ensure_compat('rolling',
                         'apply',
                         arg,
                         window=window,
                         freq=freq,
                         center=center,
                         min_periods=min_periods,
                         func_kw=['func', 'args', 'kwargs'],
                         func=func,
                         args=args,
                         kwargs=kwargs)


def rolling_window(arg, window=None, win_type=None, min_periods=None,
                   freq=None, center=False, mean=True,
                   axis=0, how=None, **kwargs):
    """
    Applies a moving window of type ``window_type`` and size ``window``
    on the data.

    Parameters
    ----------
    arg : Series, DataFrame
    window : int or ndarray
        Weighting window specification. If the window is an integer, then it is
        treated as the window length and win_type is required
    win_type : str, default None
        Window type (see Notes)
    min_periods : int, default None
        Minimum number of observations in window required to have a value
        (otherwise result is NA).
    freq : string or DateOffset object, optional (default None)
        Frequency to conform the data to before computing the
        statistic. Specified as a frequency string or DateOffset object.
    center : boolean, default False
        Whether the label should correspond with center of window
    mean : boolean, default True
        If True computes weighted mean, else weighted sum
    axis : {0, 1}, default 0
    how : string, default 'mean'
        Method for down- or re-sampling

    Returns
    -------
    y : type of input argument

    Notes
    -----
    The recognized window types are:

    * ``boxcar``
    * ``triang``
    * ``blackman``
    * ``hamming``
    * ``bartlett``
    * ``parzen``
    * ``bohman``
    * ``blackmanharris``
    * ``nuttall``
    * ``barthann``
    * ``kaiser`` (needs beta)
    * ``gaussian`` (needs std)
    * ``general_gaussian`` (needs power, width)
    * ``slepian`` (needs width).

    By default, the result is set to the right edge of the window. This can be
    changed to the center of the window by setting ``center=True``.

    The `freq` keyword is used to conform time series data to a specified
    frequency by resampling the data. This is done with the default parameters
    of :meth:`~pandas.Series.resample` (i.e. using the `mean`).

    To learn more about the frequency strings, please see `this link
    <http://pandas.pydata.org/pandas-docs/stable/timeseries.html#offset-aliases>`__.
    """
    func = 'mean' if mean else 'sum'
    return ensure_compat('rolling',
                         func,
                         arg,
                         window=window,
                         win_type=win_type,
                         freq=freq,
                         center=center,
                         min_periods=min_periods,
                         axis=axis,
                         func_kw=kwargs.keys(),
                         **kwargs)


def _expanding_func(name, desc, func_kw=None, additional_kw=''):
    @Substitution(desc, _unary_arg, _expanding_kw + additional_kw,
                  _type_of_input_retval, "")
    @Appender(_doc_template)
    def f(arg, min_periods=1, freq=None, **kwargs):
        return ensure_compat('expanding',
                             name,
                             arg,
                             min_periods=min_periods,
                             freq=freq,
                             func_kw=func_kw,
                             **kwargs)
    return f


expanding_max = _expanding_func('max', 'Expanding maximum.')
expanding_min = _expanding_func('min', 'Expanding minimum.')
expanding_sum = _expanding_func('sum', 'Expanding sum.')
expanding_mean = _expanding_func('mean', 'Expanding mean.')
expanding_median = _expanding_func('median', 'Expanding median.')

expanding_std = _expanding_func('std', 'Expanding standard deviation.',
                                func_kw=['ddof'],
                                additional_kw=_ddof_kw)
expanding_var = _expanding_func('var', 'Expanding variance.',
                                func_kw=['ddof'],
                                additional_kw=_ddof_kw)
expanding_skew = _expanding_func('skew', 'Unbiased expanding skewness.')
expanding_kurt = _expanding_func('kurt', 'Unbiased expanding kurtosis.')


def expanding_count(arg, freq=None):
    """
    Expanding count of number of non-NaN observations.

    Parameters
    ----------
    arg :  DataFrame or numpy ndarray-like
    freq : string or DateOffset object, optional (default None)
        Frequency to conform the data to before computing the
        statistic. Specified as a frequency string or DateOffset object.

    Returns
    -------
    expanding_count : type of caller

    Notes
    -----
    The `freq` keyword is used to conform time series data to a specified
    frequency by resampling the data. This is done with the default parameters
    of :meth:`~pandas.Series.resample` (i.e. using the `mean`).

    To learn more about the frequency strings, please see `this link
    <http://pandas.pydata.org/pandas-docs/stable/timeseries.html#offset-aliases>`__.
    """
    return ensure_compat('expanding', 'count', arg, freq=freq)


def expanding_quantile(arg, quantile, min_periods=1, freq=None):
    """Expanding quantile.

    Parameters
    ----------
    arg : Series, DataFrame
    quantile : float
        0 <= quantile <= 1
    min_periods : int, default None
        Minimum number of observations in window required to have a value
        (otherwise result is NA).
    freq : string or DateOffset object, optional (default None)
        Frequency to conform the data to before computing the
        statistic. Specified as a frequency string or DateOffset object.

    Returns
    -------
    y : type of input argument

    Notes
    -----
    The `freq` keyword is used to conform time series data to a specified
    frequency by resampling the data. This is done with the default parameters
    of :meth:`~pandas.Series.resample` (i.e. using the `mean`).

    To learn more about the frequency strings, please see `this link
    <http://pandas.pydata.org/pandas-docs/stable/timeseries.html#offset-aliases>`__.
    """
    return ensure_compat('expanding',
                         'quantile',
                         arg,
                         freq=freq,
                         min_periods=min_periods,
                         func_kw=['quantile'],
                         quantile=quantile)


@Substitution("Unbiased expanding covariance.", _binary_arg_flex,
              _expanding_kw + _pairwise_kw + _ddof_kw, _flex_retval, "")
@Appender(_doc_template)
def expanding_cov(arg1, arg2=None, min_periods=1, freq=None,
                  pairwise=None, ddof=1):
    if arg2 is None:
        arg2 = arg1
        pairwise = True if pairwise is None else pairwise
    elif isinstance(arg2, (int, float)) and min_periods is None:
        min_periods = arg2
        arg2 = arg1
        pairwise = True if pairwise is None else pairwise
    return ensure_compat('expanding',
                         'cov',
                         arg1,
                         other=arg2,
                         min_periods=min_periods,
                         pairwise=pairwise,
                         freq=freq,
                         ddof=ddof,
                         func_kw=['other', 'pairwise', 'ddof'])


@Substitution("Expanding sample correlation.", _binary_arg_flex,
              _expanding_kw + _pairwise_kw, _flex_retval, "")
@Appender(_doc_template)
def expanding_corr(arg1, arg2=None, min_periods=1, freq=None, pairwise=None):
    if arg2 is None:
        arg2 = arg1
        pairwise = True if pairwise is None else pairwise
    elif isinstance(arg2, (int, float)) and min_periods is None:
        min_periods = arg2
        arg2 = arg1
        pairwise = True if pairwise is None else pairwise
    return ensure_compat('expanding',
                         'corr',
                         arg1,
                         other=arg2,
                         min_periods=min_periods,
                         pairwise=pairwise,
                         freq=freq,
                         func_kw=['other', 'pairwise', 'ddof'])


def expanding_apply(arg, func, min_periods=1, freq=None,
                    args=(), kwargs={}):
    """Generic expanding function application.

    Parameters
    ----------
    arg : Series, DataFrame
    func : function
        Must produce a single value from an ndarray input
    min_periods : int, default None
        Minimum number of observations in window required to have a value
        (otherwise result is NA).
    freq : string or DateOffset object, optional (default None)
        Frequency to conform the data to before computing the
        statistic. Specified as a frequency string or DateOffset object.
    args : tuple
        Passed on to func
    kwargs : dict
        Passed on to func

    Returns
    -------
    y : type of input argument

    Notes
    -----
    The `freq` keyword is used to conform time series data to a specified
    frequency by resampling the data. This is done with the default parameters
    of :meth:`~pandas.Series.resample` (i.e. using the `mean`).

    To learn more about the frequency strings, please see `this link
    <http://pandas.pydata.org/pandas-docs/stable/timeseries.html#offset-aliases>`__.
    """
    return ensure_compat('expanding',
                         'apply',
                         arg,
                         freq=freq,
                         min_periods=min_periods,
                         func_kw=['func', 'args', 'kwargs'],
                         func=func,
                         args=args,
                         kwargs=kwargs)
