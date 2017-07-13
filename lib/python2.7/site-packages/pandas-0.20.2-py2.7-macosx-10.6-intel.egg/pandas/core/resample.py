from datetime import timedelta
import numpy as np
import warnings
import copy
from textwrap import dedent

import pandas as pd
from pandas.core.base import AbstractMethodError, GroupByMixin

from pandas.core.groupby import (BinGrouper, Grouper, _GroupBy, GroupBy,
                                 SeriesGroupBy, groupby, PanelGroupBy)

from pandas.tseries.frequencies import to_offset, is_subperiod, is_superperiod
from pandas.core.indexes.datetimes import DatetimeIndex, date_range
from pandas.core.indexes.timedeltas import TimedeltaIndex
from pandas.tseries.offsets import DateOffset, Tick, Day, _delta_to_nanoseconds
from pandas.core.indexes.period import PeriodIndex, period_range
import pandas.core.common as com
import pandas.core.algorithms as algos

import pandas.compat as compat
from pandas.compat.numpy import function as nv

from pandas._libs import lib, tslib
from pandas._libs.lib import Timestamp
from pandas._libs.period import IncompatibleFrequency

from pandas.util._decorators import Appender
from pandas.core.generic import _shared_docs
_shared_docs_kwargs = dict()


class Resampler(_GroupBy):

    """
    Class for resampling datetimelike data, a groupby-like operation.
    See aggregate, transform, and apply functions on this object.

    It's easiest to use obj.resample(...) to use Resampler.

    Parameters
    ----------
    obj : pandas object
    groupby : a TimeGrouper object
    axis : int, default 0
    kind : str or None
        'period', 'timestamp' to override default index treatement

    Notes
    -----
    After resampling, see aggregate, apply, and transform functions.

    Returns
    -------
    a Resampler of the appropriate type
    """

    # to the groupby descriptor
    _attributes = ['freq', 'axis', 'closed', 'label', 'convention',
                   'loffset', 'base', 'kind']

    # API compat of allowed attributes
    _deprecated_valids = _attributes + ['__doc__', '_cache', '_attributes',
                                        'binner', 'grouper', 'groupby',
                                        'sort', 'kind', 'squeeze', 'keys',
                                        'group_keys', 'as_index', 'exclusions',
                                        '_groupby']

    # don't raise deprecation warning on attributes starting with these
    # patterns - prevents warnings caused by IPython introspection
    _deprecated_valid_patterns = ['_ipython', '_repr']

    # API compat of disallowed attributes
    _deprecated_invalids = ['iloc', 'loc', 'ix', 'iat', 'at']

    def __init__(self, obj, groupby=None, axis=0, kind=None, **kwargs):
        self.groupby = groupby
        self.keys = None
        self.sort = True
        self.axis = axis
        self.kind = kind
        self.squeeze = False
        self.group_keys = True
        self.as_index = True
        self.exclusions = set()
        self.binner = None
        self.grouper = None

        if self.groupby is not None:
            self.groupby._set_grouper(self._convert_obj(obj), sort=True)

    def __unicode__(self):
        """ provide a nice str repr of our rolling object """
        attrs = ["{k}={v}".format(k=k, v=getattr(self.groupby, k))
                 for k in self._attributes if
                 getattr(self.groupby, k, None) is not None]
        return "{klass} [{attrs}]".format(klass=self.__class__.__name__,
                                          attrs=', '.join(attrs))

    @property
    def obj(self):
        return self.groupby.obj

    @property
    def ax(self):
        return self.groupby.ax

    @property
    def _typ(self):
        """ masquerade for compat as a Series or a DataFrame """
        if isinstance(self._selected_obj, pd.Series):
            return 'series'
        return 'dataframe'

    @property
    def _from_selection(self):
        """ is the resampling from a DataFrame column or MultiIndex level """
        # upsampling and PeriodIndex resampling do not work
        # with selection, this state used to catch and raise an error
        return (self.groupby is not None and
                (self.groupby.key is not None or
                 self.groupby.level is not None))

    def _deprecated(self, op):
        warnings.warn(("\n.resample() is now a deferred operation\n"
                       "You called {op}(...) on this deferred object "
                       "which materialized it into a {klass}\nby implicitly "
                       "taking the mean.  Use .resample(...).mean() "
                       "instead").format(op=op, klass=self._typ),
                      FutureWarning, stacklevel=3)
        return self.mean()

    def _make_deprecated_binop(op):
        # op is a string

        def _evaluate_numeric_binop(self, other):
            result = self._deprecated(op)
            return getattr(result, op)(other)
        return _evaluate_numeric_binop

    def _make_deprecated_unary(op, name):
        # op is a callable

        def _evaluate_numeric_unary(self):
            result = self._deprecated(name)
            return op(result)
        return _evaluate_numeric_unary

    def __array__(self):
        return self._deprecated('__array__').__array__()

    __gt__ = _make_deprecated_binop('__gt__')
    __ge__ = _make_deprecated_binop('__ge__')
    __lt__ = _make_deprecated_binop('__lt__')
    __le__ = _make_deprecated_binop('__le__')
    __eq__ = _make_deprecated_binop('__eq__')
    __ne__ = _make_deprecated_binop('__ne__')

    __add__ = __radd__ = _make_deprecated_binop('__add__')
    __sub__ = __rsub__ = _make_deprecated_binop('__sub__')
    __mul__ = __rmul__ = _make_deprecated_binop('__mul__')
    __floordiv__ = __rfloordiv__ = _make_deprecated_binop('__floordiv__')
    __truediv__ = __rtruediv__ = _make_deprecated_binop('__truediv__')
    if not compat.PY3:
        __div__ = __rdiv__ = _make_deprecated_binop('__div__')
    __neg__ = _make_deprecated_unary(lambda x: -x, '__neg__')
    __pos__ = _make_deprecated_unary(lambda x: x, '__pos__')
    __abs__ = _make_deprecated_unary(lambda x: np.abs(x), '__abs__')
    __inv__ = _make_deprecated_unary(lambda x: -x, '__inv__')

    def __getattr__(self, attr):
        if attr in self._internal_names_set:
            return object.__getattribute__(self, attr)
        if attr in self._attributes:
            return getattr(self.groupby, attr)
        if attr in self.obj:
            return self[attr]

        if attr in self._deprecated_invalids:
            raise ValueError(".resample() is now a deferred operation\n"
                             "\tuse .resample(...).mean() instead of "
                             ".resample(...)")

        matches_pattern = any(attr.startswith(x) for x
                              in self._deprecated_valid_patterns)
        if not matches_pattern and attr not in self._deprecated_valids:
            # avoid the warning, if it's just going to be an exception
            # anyway.
            if not hasattr(self.obj, attr):
                raise AttributeError("'{}' has no attribute '{}'".format(
                    type(self.obj).__name__, attr
                ))
            self = self._deprecated(attr)

        return object.__getattribute__(self, attr)

    def __setattr__(self, attr, value):
        if attr not in self._deprecated_valids:
            raise ValueError("cannot set values on {0}".format(
                self.__class__.__name__))
        object.__setattr__(self, attr, value)

    def __getitem__(self, key):
        try:
            return super(Resampler, self).__getitem__(key)
        except (KeyError, com.AbstractMethodError):

            # compat for deprecated
            if isinstance(self.obj, com.ABCSeries):
                return self._deprecated('__getitem__')[key]

            raise

    def __setitem__(self, attr, value):
        raise ValueError("cannot set items on {0}".format(
            self.__class__.__name__))

    def _convert_obj(self, obj):
        """
        provide any conversions for the object in order to correctly handle

        Parameters
        ----------
        obj : the object to be resampled

        Returns
        -------
        obj : converted object
        """
        obj = obj._consolidate()
        return obj

    def _get_binner_for_time(self):
        raise AbstractMethodError(self)

    def _set_binner(self):
        """
        setup our binners
        cache these as we are an immutable object
        """

        if self.binner is None:
            self.binner, self.grouper = self._get_binner()

    def _get_binner(self):
        """
        create the BinGrouper, assume that self.set_grouper(obj)
        has already been called
        """

        binner, bins, binlabels = self._get_binner_for_time()
        bin_grouper = BinGrouper(bins, binlabels)
        return binner, bin_grouper

    def _assure_grouper(self):
        """ make sure that we are creating our binner & grouper """
        self._set_binner()

    def plot(self, *args, **kwargs):
        # for compat with prior versions, we want to
        # have the warnings shown here and just have this work
        return self._deprecated('plot').plot(*args, **kwargs)

    _agg_doc = dedent("""

    Examples
    --------
    >>> s = Series([1,2,3,4,5],
                    index=pd.date_range('20130101',
                                        periods=5,freq='s'))
    2013-01-01 00:00:00    1
    2013-01-01 00:00:01    2
    2013-01-01 00:00:02    3
    2013-01-01 00:00:03    4
    2013-01-01 00:00:04    5
    Freq: S, dtype: int64

    >>> r = s.resample('2s')
    DatetimeIndexResampler [freq=<2 * Seconds>, axis=0, closed=left,
                            label=left, convention=start, base=0]

    >>> r.agg(np.sum)
    2013-01-01 00:00:00    3
    2013-01-01 00:00:02    7
    2013-01-01 00:00:04    5
    Freq: 2S, dtype: int64

    >>> r.agg(['sum','mean','max'])
                         sum  mean  max
    2013-01-01 00:00:00    3   1.5    2
    2013-01-01 00:00:02    7   3.5    4
    2013-01-01 00:00:04    5   5.0    5

    >>> r.agg({'result' : lambda x: x.mean() / x.std(),
               'total' : np.sum})
                         total    result
    2013-01-01 00:00:00      3  2.121320
    2013-01-01 00:00:02      7  4.949747
    2013-01-01 00:00:04      5       NaN

    See also
    --------
    pandas.DataFrame.groupby.aggregate
    pandas.DataFrame.resample.transform
    pandas.DataFrame.aggregate

    """)

    @Appender(_agg_doc)
    @Appender(_shared_docs['aggregate'] % dict(
        klass='DataFrame',
        versionadded=''))
    def aggregate(self, arg, *args, **kwargs):

        self._set_binner()
        result, how = self._aggregate(arg, *args, **kwargs)
        if result is None:
            result = self._groupby_and_aggregate(arg,
                                                 *args,
                                                 **kwargs)

        result = self._apply_loffset(result)
        return result

    agg = aggregate
    apply = aggregate

    def transform(self, arg, *args, **kwargs):
        """
        Call function producing a like-indexed Series on each group and return
        a Series with the transformed values

        Parameters
        ----------
        func : function
            To apply to each group. Should return a Series with the same index

        Examples
        --------
        >>> resampled.transform(lambda x: (x - x.mean()) / x.std())

        Returns
        -------
        transformed : Series
        """
        return self._selected_obj.groupby(self.groupby).transform(
            arg, *args, **kwargs)

    def _downsample(self, f):
        raise AbstractMethodError(self)

    def _upsample(self, f, limit=None, fill_value=None):
        raise AbstractMethodError(self)

    def _gotitem(self, key, ndim, subset=None):
        """
        sub-classes to define
        return a sliced object

        Parameters
        ----------
        key : string / list of selections
        ndim : 1,2
            requested ndim of result
        subset : object, default None
            subset to act on
        """
        self._set_binner()
        grouper = self.grouper
        if subset is None:
            subset = self.obj
        grouped = groupby(subset, by=None, grouper=grouper, axis=self.axis)

        # try the key selection
        try:
            return grouped[key]
        except KeyError:
            return grouped

    def _groupby_and_aggregate(self, how, grouper=None, *args, **kwargs):
        """ re-evaluate the obj with a groupby aggregation """

        if grouper is None:
            self._set_binner()
            grouper = self.grouper

        obj = self._selected_obj

        try:
            grouped = groupby(obj, by=None, grouper=grouper, axis=self.axis)
        except TypeError:

            # panel grouper
            grouped = PanelGroupBy(obj, grouper=grouper, axis=self.axis)

        try:
            result = grouped.aggregate(how, *args, **kwargs)
        except Exception:

            # we have a non-reducing function
            # try to evaluate
            result = grouped.apply(how, *args, **kwargs)

        result = self._apply_loffset(result)
        return self._wrap_result(result)

    def _apply_loffset(self, result):
        """
        if loffset is set, offset the result index

        This is NOT an idempotent routine, it will be applied
        exactly once to the result.

        Parameters
        ----------
        result : Series or DataFrame
            the result of resample
        """

        needs_offset = (
            isinstance(self.loffset, (DateOffset, timedelta)) and
            isinstance(result.index, DatetimeIndex) and
            len(result.index) > 0
        )

        if needs_offset:
            result.index = result.index + self.loffset

        self.loffset = None
        return result

    def _get_resampler_for_grouping(self, groupby, **kwargs):
        """ return the correct class for resampling with groupby """
        return self._resampler_for_grouping(self, groupby=groupby, **kwargs)

    def _wrap_result(self, result):
        """ potentially wrap any results """
        if isinstance(result, com.ABCSeries) and self._selection is not None:
            result.name = self._selection

        return result

    def pad(self, limit=None):
        """
        Forward fill the values

        Parameters
        ----------
        limit : integer, optional
            limit of how many values to fill

        See Also
        --------
        Series.fillna
        DataFrame.fillna
        """
        return self._upsample('pad', limit=limit)
    ffill = pad

    def backfill(self, limit=None):
        """
        Backward fill the values

        Parameters
        ----------
        limit : integer, optional
            limit of how many values to fill

        See Also
        --------
        Series.fillna
        DataFrame.fillna
        """
        return self._upsample('backfill', limit=limit)
    bfill = backfill

    def fillna(self, method, limit=None):
        """
        Fill missing values

        Parameters
        ----------
        method : str, method of resampling ('ffill', 'bfill')
        limit : integer, optional
            limit of how many values to fill

        See Also
        --------
        Series.fillna
        DataFrame.fillna
        """
        return self._upsample(method, limit=limit)

    @Appender(_shared_docs['interpolate'] % _shared_docs_kwargs)
    def interpolate(self, method='linear', axis=0, limit=None, inplace=False,
                    limit_direction='forward', downcast=None, **kwargs):
        """
        Interpolate values according to different methods.

        .. versionadded:: 0.18.1
        """
        result = self._upsample(None)
        return result.interpolate(method=method, axis=axis, limit=limit,
                                  inplace=inplace,
                                  limit_direction=limit_direction,
                                  downcast=downcast, **kwargs)

    def asfreq(self, fill_value=None):
        """
        return the values at the new freq,
        essentially a reindex

        Parameters
        ----------
        fill_value: scalar, optional
            Value to use for missing values, applied during upsampling (note
            this does not fill NaNs that already were present).

            .. versionadded:: 0.20.0

        See Also
        --------
        Series.asfreq
        DataFrame.asfreq
        """
        return self._upsample('asfreq', fill_value=fill_value)

    def std(self, ddof=1, *args, **kwargs):
        """
        Compute standard deviation of groups, excluding missing values

        Parameters
        ----------
        ddof : integer, default 1
        degrees of freedom
        """
        nv.validate_resampler_func('std', args, kwargs)
        return self._downsample('std', ddof=ddof)

    def var(self, ddof=1, *args, **kwargs):
        """
        Compute variance of groups, excluding missing values

        Parameters
        ----------
        ddof : integer, default 1
        degrees of freedom
        """
        nv.validate_resampler_func('var', args, kwargs)
        return self._downsample('var', ddof=ddof)


Resampler._deprecated_valids += dir(Resampler)

# downsample methods
for method in ['min', 'max', 'first', 'last', 'sum', 'mean', 'sem',
               'median', 'prod', 'ohlc']:

    def f(self, _method=method, *args, **kwargs):
        nv.validate_resampler_func(_method, args, kwargs)
        return self._downsample(_method)
    f.__doc__ = getattr(GroupBy, method).__doc__
    setattr(Resampler, method, f)

# groupby & aggregate methods
for method in ['count', 'size']:

    def f(self, _method=method):
        return self._downsample(_method)
    f.__doc__ = getattr(GroupBy, method).__doc__
    setattr(Resampler, method, f)

# series only methods
for method in ['nunique']:
    def f(self, _method=method):
        return self._downsample(_method)
    f.__doc__ = getattr(SeriesGroupBy, method).__doc__
    setattr(Resampler, method, f)


def _maybe_process_deprecations(r, how=None, fill_method=None, limit=None):
    """ potentially we might have a deprecation warning, show it
    but call the appropriate methods anyhow """

    if how is not None:

        # .resample(..., how='sum')
        if isinstance(how, compat.string_types):
            method = "{0}()".format(how)

            # .resample(..., how=lambda x: ....)
        else:
            method = ".apply(<func>)"

        # if we have both a how and fill_method, then show
        # the following warning
        if fill_method is None:
            warnings.warn("how in .resample() is deprecated\n"
                          "the new syntax is "
                          ".resample(...).{method}".format(
                              method=method),
                          FutureWarning, stacklevel=3)
        r = r.aggregate(how)

    if fill_method is not None:

        # show the prior function call
        method = '.' + method if how is not None else ''

        args = "limit={0}".format(limit) if limit is not None else ""
        warnings.warn("fill_method is deprecated to .resample()\n"
                      "the new syntax is .resample(...){method}"
                      ".{fill_method}({args})".format(
                          method=method,
                          fill_method=fill_method,
                          args=args),
                      FutureWarning, stacklevel=3)

        if how is not None:
            r = getattr(r, fill_method)(limit=limit)
        else:
            r = r.aggregate(fill_method, limit=limit)

    return r


class _GroupByMixin(GroupByMixin):
    """ provide the groupby facilities """

    def __init__(self, obj, *args, **kwargs):

        parent = kwargs.pop('parent', None)
        groupby = kwargs.pop('groupby', None)
        if parent is None:
            parent = obj

        # initialize our GroupByMixin object with
        # the resampler attributes
        for attr in self._attributes:
            setattr(self, attr, kwargs.get(attr, getattr(parent, attr)))

        super(_GroupByMixin, self).__init__(None)
        self._groupby = groupby
        self._groupby.mutated = True
        self._groupby.grouper.mutated = True
        self.groupby = copy.copy(parent.groupby)

    def _apply(self, f, **kwargs):
        """
        dispatch to _upsample; we are stripping all of the _upsample kwargs and
        performing the original function call on the grouped object
        """

        def func(x):
            x = self._shallow_copy(x, groupby=self.groupby)

            if isinstance(f, compat.string_types):
                return getattr(x, f)(**kwargs)

            return x.apply(f, **kwargs)

        result = self._groupby.apply(func)
        return self._wrap_result(result)

    _upsample = _apply
    _downsample = _apply
    _groupby_and_aggregate = _apply


class DatetimeIndexResampler(Resampler):

    @property
    def _resampler_for_grouping(self):
        return DatetimeIndexResamplerGroupby

    def _get_binner_for_time(self):

        # this is how we are actually creating the bins
        if self.kind == 'period':
            return self.groupby._get_time_period_bins(self.ax)
        return self.groupby._get_time_bins(self.ax)

    def _downsample(self, how, **kwargs):
        """
        Downsample the cython defined function

        Parameters
        ----------
        how : string / cython mapped function
        **kwargs : kw args passed to how function
        """
        self._set_binner()
        how = self._is_cython_func(how) or how
        ax = self.ax
        obj = self._selected_obj

        if not len(ax):
            # reset to the new freq
            obj = obj.copy()
            obj.index.freq = self.freq
            return obj

        # do we have a regular frequency
        if ax.freq is not None or ax.inferred_freq is not None:

            if len(self.grouper.binlabels) > len(ax) and how is None:

                # let's do an asfreq
                return self.asfreq()

        # we are downsampling
        # we want to call the actual grouper method here
        result = obj.groupby(
            self.grouper, axis=self.axis).aggregate(how, **kwargs)

        result = self._apply_loffset(result)
        return self._wrap_result(result)

    def _adjust_binner_for_upsample(self, binner):
        """ adjust our binner when upsampling """
        if self.closed == 'right':
            binner = binner[1:]
        else:
            binner = binner[:-1]
        return binner

    def _upsample(self, method, limit=None, fill_value=None):
        """
        method : string {'backfill', 'bfill', 'pad',
            'ffill', 'asfreq'} method for upsampling
        limit : int, default None
            Maximum size gap to fill when reindexing
        fill_value : scalar, default None
            Value to use for missing values

        See also
        --------
        .fillna

        """
        self._set_binner()
        if self.axis:
            raise AssertionError('axis must be 0')
        if self._from_selection:
            raise ValueError("Upsampling from level= or on= selection"
                             " is not supported, use .set_index(...)"
                             " to explicitly set index to"
                             " datetime-like")

        ax = self.ax
        obj = self._selected_obj
        binner = self.binner
        res_index = self._adjust_binner_for_upsample(binner)

        # if we have the same frequency as our axis, then we are equal sampling
        if limit is None and to_offset(ax.inferred_freq) == self.freq:
            result = obj.copy()
            result.index = res_index
        else:
            result = obj.reindex(res_index, method=method,
                                 limit=limit, fill_value=fill_value)

        return self._wrap_result(result)

    def _wrap_result(self, result):
        result = super(DatetimeIndexResampler, self)._wrap_result(result)

        # we may have a different kind that we were asked originally
        # convert if needed
        if self.kind == 'period' and not isinstance(result.index, PeriodIndex):
            result.index = result.index.to_period(self.freq)
        return result


class DatetimeIndexResamplerGroupby(_GroupByMixin, DatetimeIndexResampler):
    """
    Provides a resample of a groupby implementation

    .. versionadded:: 0.18.1

    """
    @property
    def _constructor(self):
        return DatetimeIndexResampler


class PeriodIndexResampler(DatetimeIndexResampler):

    @property
    def _resampler_for_grouping(self):
        return PeriodIndexResamplerGroupby

    def _convert_obj(self, obj):
        obj = super(PeriodIndexResampler, self)._convert_obj(obj)

        offset = to_offset(self.freq)
        if offset.n > 1:
            if self.kind == 'period':  # pragma: no cover
                print('Warning: multiple of frequency -> timestamps')

            # Cannot have multiple of periods, convert to timestamp
            self.kind = 'timestamp'

        # convert to timestamp
        if not (self.kind is None or self.kind == 'period'):
            if self._from_selection:
                # see GH 14008, GH 12871
                msg = ("Resampling from level= or on= selection"
                       " with a PeriodIndex is not currently supported,"
                       " use .set_index(...) to explicitly set index")
                raise NotImplementedError(msg)
            else:
                obj = obj.to_timestamp(how=self.convention)

        return obj

    def aggregate(self, arg, *args, **kwargs):
        result, how = self._aggregate(arg, *args, **kwargs)
        if result is None:
            result = self._downsample(arg, *args, **kwargs)

        result = self._apply_loffset(result)
        return result

    agg = aggregate

    def _get_new_index(self):
        """ return our new index """
        ax = self.ax

        if len(ax) == 0:
            values = []
        else:
            start = ax[0].asfreq(self.freq, how=self.convention)
            end = ax[-1].asfreq(self.freq, how='end')
            values = period_range(start, end, freq=self.freq).asi8

        return ax._shallow_copy(values, freq=self.freq)

    def _downsample(self, how, **kwargs):
        """
        Downsample the cython defined function

        Parameters
        ----------
        how : string / cython mapped function
        **kwargs : kw args passed to how function
        """

        # we may need to actually resample as if we are timestamps
        if self.kind == 'timestamp':
            return super(PeriodIndexResampler, self)._downsample(how, **kwargs)

        how = self._is_cython_func(how) or how
        ax = self.ax

        new_index = self._get_new_index()

        # Start vs. end of period
        memb = ax.asfreq(self.freq, how=self.convention)

        if is_subperiod(ax.freq, self.freq):
            # Downsampling
            if len(new_index) == 0:
                bins = []
            else:
                i8 = memb.asi8
                rng = np.arange(i8[0], i8[-1] + 1)
                bins = memb.searchsorted(rng, side='right')
            grouper = BinGrouper(bins, new_index)
            return self._groupby_and_aggregate(how, grouper=grouper)
        elif is_superperiod(ax.freq, self.freq):
            return self.asfreq()
        elif ax.freq == self.freq:
            return self.asfreq()

        raise IncompatibleFrequency(
            'Frequency {} cannot be resampled to {}, as they are not '
            'sub or super periods'.format(ax.freq, self.freq))

    def _upsample(self, method, limit=None, fill_value=None):
        """
        method : string {'backfill', 'bfill', 'pad', 'ffill'}
            method for upsampling
        limit : int, default None
            Maximum size gap to fill when reindexing
        fill_value : scalar, default None
            Value to use for missing values

        See also
        --------
        .fillna

        """
        if self._from_selection:
            raise ValueError("Upsampling from level= or on= selection"
                             " is not supported, use .set_index(...)"
                             " to explicitly set index to"
                             " datetime-like")
        # we may need to actually resample as if we are timestamps
        if self.kind == 'timestamp':
            return super(PeriodIndexResampler, self)._upsample(
                method, limit=limit, fill_value=fill_value)

        ax = self.ax
        obj = self.obj
        new_index = self._get_new_index()

        # Start vs. end of period
        memb = ax.asfreq(self.freq, how=self.convention)

        # Get the fill indexer
        indexer = memb.get_indexer(new_index, method=method, limit=limit)
        return self._wrap_result(_take_new_index(
            obj, indexer, new_index, axis=self.axis))


class PeriodIndexResamplerGroupby(_GroupByMixin, PeriodIndexResampler):
    """
    Provides a resample of a groupby implementation

    .. versionadded:: 0.18.1

    """
    @property
    def _constructor(self):
        return PeriodIndexResampler


class TimedeltaIndexResampler(DatetimeIndexResampler):

    @property
    def _resampler_for_grouping(self):
        return TimedeltaIndexResamplerGroupby

    def _get_binner_for_time(self):
        return self.groupby._get_time_delta_bins(self.ax)

    def _adjust_binner_for_upsample(self, binner):
        """ adjust our binner when upsampling """
        ax = self.ax

        if is_subperiod(ax.freq, self.freq):
            # We are actually downsampling
            # but are in the asfreq path
            # GH 12926
            if self.closed == 'right':
                binner = binner[1:]
            else:
                binner = binner[:-1]
        return binner


class TimedeltaIndexResamplerGroupby(_GroupByMixin, TimedeltaIndexResampler):
    """
    Provides a resample of a groupby implementation

    .. versionadded:: 0.18.1

    """
    @property
    def _constructor(self):
        return TimedeltaIndexResampler


def resample(obj, kind=None, **kwds):
    """ create a TimeGrouper and return our resampler """
    tg = TimeGrouper(**kwds)
    return tg._get_resampler(obj, kind=kind)


resample.__doc__ = Resampler.__doc__


def get_resampler_for_grouping(groupby, rule, how=None, fill_method=None,
                               limit=None, kind=None, **kwargs):
    """ return our appropriate resampler when grouping as well """

    # .resample uses 'on' similar to how .groupby uses 'key'
    kwargs['key'] = kwargs.pop('on', None)

    tg = TimeGrouper(freq=rule, **kwargs)
    resampler = tg._get_resampler(groupby.obj, kind=kind)
    r = resampler._get_resampler_for_grouping(groupby=groupby)
    return _maybe_process_deprecations(r,
                                       how=how,
                                       fill_method=fill_method,
                                       limit=limit)


class TimeGrouper(Grouper):
    """
    Custom groupby class for time-interval grouping

    Parameters
    ----------
    freq : pandas date offset or offset alias for identifying bin edges
    closed : closed end of interval; left or right
    label : interval boundary to use for labeling; left or right
    nperiods : optional, integer
    convention : {'start', 'end', 'e', 's'}
        If axis is PeriodIndex

    Notes
    -----
    Use begin, end, nperiods to generate intervals that cannot be derived
    directly from the associated object
    """

    def __init__(self, freq='Min', closed=None, label=None, how='mean',
                 nperiods=None, axis=0,
                 fill_method=None, limit=None, loffset=None, kind=None,
                 convention=None, base=0, **kwargs):
        freq = to_offset(freq)

        end_types = set(['M', 'A', 'Q', 'BM', 'BA', 'BQ', 'W'])
        rule = freq.rule_code
        if (rule in end_types or
                ('-' in rule and rule[:rule.find('-')] in end_types)):
            if closed is None:
                closed = 'right'
            if label is None:
                label = 'right'
        else:
            if closed is None:
                closed = 'left'
            if label is None:
                label = 'left'

        self.closed = closed
        self.label = label
        self.nperiods = nperiods
        self.kind = kind

        self.convention = convention or 'E'
        self.convention = self.convention.lower()

        if isinstance(loffset, compat.string_types):
            loffset = to_offset(loffset)
        self.loffset = loffset

        self.how = how
        self.fill_method = fill_method
        self.limit = limit
        self.base = base

        # always sort time groupers
        kwargs['sort'] = True

        super(TimeGrouper, self).__init__(freq=freq, axis=axis, **kwargs)

    def _get_resampler(self, obj, kind=None):
        """
        return my resampler or raise if we have an invalid axis

        Parameters
        ----------
        obj : input object
        kind : string, optional
            'period','timestamp','timedelta' are valid

        Returns
        -------
        a Resampler

        Raises
        ------
        TypeError if incompatible axis

        """
        self._set_grouper(obj)

        ax = self.ax
        if isinstance(ax, DatetimeIndex):
            return DatetimeIndexResampler(obj,
                                          groupby=self,
                                          kind=kind,
                                          axis=self.axis)
        elif isinstance(ax, PeriodIndex) or kind == 'period':
            return PeriodIndexResampler(obj,
                                        groupby=self,
                                        kind=kind,
                                        axis=self.axis)
        elif isinstance(ax, TimedeltaIndex):
            return TimedeltaIndexResampler(obj,
                                           groupby=self,
                                           axis=self.axis)

        raise TypeError("Only valid with DatetimeIndex, "
                        "TimedeltaIndex or PeriodIndex, "
                        "but got an instance of %r" % type(ax).__name__)

    def _get_grouper(self, obj):
        # create the resampler and return our binner
        r = self._get_resampler(obj)
        r._set_binner()
        return r.binner, r.grouper, r.obj

    def _get_binner_for_grouping(self, obj):
        # return an ordering of the transformed group labels,
        # suitable for multi-grouping, e.g the labels for
        # the resampled intervals
        binner, grouper, obj = self._get_grouper(obj)

        l = []
        for key, group in grouper.get_iterator(self.ax):
            l.extend([key] * len(group))

        if isinstance(self.ax, PeriodIndex):
            grouper = binner.__class__(l, freq=binner.freq, name=binner.name)
        else:
            # resampling causes duplicated values, specifying freq is invalid
            grouper = binner.__class__(l, name=binner.name)

        # since we may have had to sort
        # may need to reorder groups here
        if self.indexer is not None:
            indexer = self.indexer.argsort(kind='quicksort')
            grouper = grouper.take(indexer)
        return grouper

    def _get_time_bins(self, ax):
        if not isinstance(ax, DatetimeIndex):
            raise TypeError('axis must be a DatetimeIndex, but got '
                            'an instance of %r' % type(ax).__name__)

        if len(ax) == 0:
            binner = labels = DatetimeIndex(
                data=[], freq=self.freq, name=ax.name)
            return binner, [], labels

        first, last = ax.min(), ax.max()
        first, last = _get_range_edges(first, last, self.freq,
                                       closed=self.closed,
                                       base=self.base)
        tz = ax.tz
        # GH #12037
        # use first/last directly instead of call replace() on them
        # because replace() will swallow the nanosecond part
        # thus last bin maybe slightly before the end if the end contains
        # nanosecond part and lead to `Values falls after last bin` error
        binner = labels = DatetimeIndex(freq=self.freq,
                                        start=first,
                                        end=last,
                                        tz=tz,
                                        name=ax.name)

        # a little hack
        trimmed = False
        if (len(binner) > 2 and binner[-2] == last and
                self.closed == 'right'):

            binner = binner[:-1]
            trimmed = True

        ax_values = ax.asi8
        binner, bin_edges = self._adjust_bin_edges(binner, ax_values)

        # general version, knowing nothing about relative frequencies
        bins = lib.generate_bins_dt64(
            ax_values, bin_edges, self.closed, hasnans=ax.hasnans)

        if self.closed == 'right':
            labels = binner
            if self.label == 'right':
                labels = labels[1:]
            elif not trimmed:
                labels = labels[:-1]
        else:
            if self.label == 'right':
                labels = labels[1:]
            elif not trimmed:
                labels = labels[:-1]

        if ax.hasnans:
            binner = binner.insert(0, tslib.NaT)
            labels = labels.insert(0, tslib.NaT)

        # if we end up with more labels than bins
        # adjust the labels
        # GH4076
        if len(bins) < len(labels):
            labels = labels[:len(bins)]

        return binner, bins, labels

    def _adjust_bin_edges(self, binner, ax_values):
        # Some hacks for > daily data, see #1471, #1458, #1483

        bin_edges = binner.asi8

        if self.freq != 'D' and is_superperiod(self.freq, 'D'):
            day_nanos = _delta_to_nanoseconds(timedelta(1))
            if self.closed == 'right':
                bin_edges = bin_edges + day_nanos - 1

            # intraday values on last day
            if bin_edges[-2] > ax_values.max():
                bin_edges = bin_edges[:-1]
                binner = binner[:-1]

        return binner, bin_edges

    def _get_time_delta_bins(self, ax):
        if not isinstance(ax, TimedeltaIndex):
            raise TypeError('axis must be a TimedeltaIndex, but got '
                            'an instance of %r' % type(ax).__name__)

        if not len(ax):
            binner = labels = TimedeltaIndex(
                data=[], freq=self.freq, name=ax.name)
            return binner, [], labels

        start = ax[0]
        end = ax[-1]
        labels = binner = TimedeltaIndex(start=start,
                                         end=end,
                                         freq=self.freq,
                                         name=ax.name)

        end_stamps = labels + 1
        bins = ax.searchsorted(end_stamps, side='left')

        # Addresses GH #10530
        if self.base > 0:
            labels += type(self.freq)(self.base)

        return binner, bins, labels

    def _get_time_period_bins(self, ax):
        if not isinstance(ax, DatetimeIndex):
            raise TypeError('axis must be a DatetimeIndex, but got '
                            'an instance of %r' % type(ax).__name__)

        if not len(ax):
            binner = labels = PeriodIndex(
                data=[], freq=self.freq, name=ax.name)
            return binner, [], labels

        labels = binner = PeriodIndex(start=ax[0],
                                      end=ax[-1],
                                      freq=self.freq,
                                      name=ax.name)

        end_stamps = (labels + 1).asfreq(self.freq, 's').to_timestamp()
        if ax.tzinfo:
            end_stamps = end_stamps.tz_localize(ax.tzinfo)
        bins = ax.searchsorted(end_stamps, side='left')

        return binner, bins, labels


def _take_new_index(obj, indexer, new_index, axis=0):
    from pandas.core.api import Series, DataFrame

    if isinstance(obj, Series):
        new_values = algos.take_1d(obj.values, indexer)
        return Series(new_values, index=new_index, name=obj.name)
    elif isinstance(obj, DataFrame):
        if axis == 1:
            raise NotImplementedError("axis 1 is not supported")
        return DataFrame(obj._data.reindex_indexer(
            new_axis=new_index, indexer=indexer, axis=1))
    else:
        raise ValueError("'obj' should be either a Series or a DataFrame")


def _get_range_edges(first, last, offset, closed='left', base=0):
    if isinstance(offset, compat.string_types):
        offset = to_offset(offset)

    if isinstance(offset, Tick):
        is_day = isinstance(offset, Day)
        day_nanos = _delta_to_nanoseconds(timedelta(1))

        # #1165
        if (is_day and day_nanos % offset.nanos == 0) or not is_day:
            return _adjust_dates_anchored(first, last, offset,
                                          closed=closed, base=base)

    if not isinstance(offset, Tick):  # and first.time() != last.time():
        # hack!
        first = first.normalize()
        last = last.normalize()

    if closed == 'left':
        first = Timestamp(offset.rollback(first))
    else:
        first = Timestamp(first - offset)

    last = Timestamp(last + offset)

    return first, last


def _adjust_dates_anchored(first, last, offset, closed='right', base=0):
    # First and last offsets should be calculated from the start day to fix an
    # error cause by resampling across multiple days when a one day period is
    # not a multiple of the frequency.
    #
    # See https://github.com/pandas-dev/pandas/issues/8683

    # 14682 - Since we need to drop the TZ information to perform
    # the adjustment in the presence of a DST change,
    # save TZ Info and the DST state of the first and last parameters
    # so that we can accurately rebuild them at the end.
    first_tzinfo = first.tzinfo
    last_tzinfo = last.tzinfo
    first_dst = bool(first.dst())
    last_dst = bool(last.dst())

    first = first.tz_localize(None)
    last = last.tz_localize(None)

    start_day_nanos = first.normalize().value

    base_nanos = (base % offset.n) * offset.nanos // offset.n
    start_day_nanos += base_nanos

    foffset = (first.value - start_day_nanos) % offset.nanos
    loffset = (last.value - start_day_nanos) % offset.nanos

    if closed == 'right':
        if foffset > 0:
            # roll back
            fresult = first.value - foffset
        else:
            fresult = first.value - offset.nanos

        if loffset > 0:
            # roll forward
            lresult = last.value + (offset.nanos - loffset)
        else:
            # already the end of the road
            lresult = last.value
    else:  # closed == 'left'
        if foffset > 0:
            fresult = first.value - foffset
        else:
            # start of the road
            fresult = first.value

        if loffset > 0:
            # roll forward
            lresult = last.value + (offset.nanos - loffset)
        else:
            lresult = last.value + offset.nanos

    return (Timestamp(fresult).tz_localize(first_tzinfo, ambiguous=first_dst),
            Timestamp(lresult).tz_localize(last_tzinfo, ambiguous=last_dst))


def asfreq(obj, freq, method=None, how=None, normalize=False, fill_value=None):
    """
    Utility frequency conversion method for Series/DataFrame
    """
    if isinstance(obj.index, PeriodIndex):
        if method is not None:
            raise NotImplementedError("'method' argument is not supported")

        if how is None:
            how = 'E'

        new_obj = obj.copy()
        new_obj.index = obj.index.asfreq(freq, how=how)

    elif len(obj.index) == 0:
        new_obj = obj.copy()
        new_obj.index = obj.index._shallow_copy(freq=to_offset(freq))

    else:
        dti = date_range(obj.index[0], obj.index[-1], freq=freq)
        dti.name = obj.index.name
        new_obj = obj.reindex(dti, method=method, fill_value=fill_value)
        if normalize:
            new_obj.index = new_obj.index.normalize()

    return new_obj
