"""
datetimelike delegation
"""

import numpy as np

from pandas.core.dtypes.common import (
    is_period_arraylike,
    is_datetime_arraylike, is_integer_dtype,
    is_datetime64_dtype, is_datetime64tz_dtype,
    is_timedelta64_dtype, is_categorical_dtype,
    is_list_like)

from pandas.core.base import PandasDelegate, NoNewAttributesMixin
from pandas.core.indexes.datetimes import DatetimeIndex
from pandas._libs.period import IncompatibleFrequency  # noqa
from pandas.core.indexes.period import PeriodIndex
from pandas.core.indexes.timedeltas import TimedeltaIndex
from pandas.core.algorithms import take_1d


def is_datetimelike(data):
    """
    return a boolean if we can be successfully converted to a datetimelike
    """
    try:
        maybe_to_datetimelike(data)
        return True
    except (Exception):
        pass
    return False


def maybe_to_datetimelike(data, copy=False):
    """
    return a DelegatedClass of a Series that is datetimelike
      (e.g. datetime64[ns],timedelta64[ns] dtype or a Series of Periods)
    raise TypeError if this is not possible.

    Parameters
    ----------
    data : Series
    copy : boolean, default False
           copy the input data

    Returns
    -------
    DelegatedClass

    """
    from pandas import Series

    if not isinstance(data, Series):
        raise TypeError("cannot convert an object of type {0} to a "
                        "datetimelike index".format(type(data)))

    index = data.index
    name = data.name
    orig = data if is_categorical_dtype(data) else None
    if orig is not None:
        data = orig.values.categories

    if is_datetime64_dtype(data.dtype):
        return DatetimeProperties(DatetimeIndex(data, copy=copy, freq='infer'),
                                  index, name=name, orig=orig)
    elif is_datetime64tz_dtype(data.dtype):
        return DatetimeProperties(DatetimeIndex(data, copy=copy, freq='infer',
                                                ambiguous='infer'),
                                  index, data.name, orig=orig)
    elif is_timedelta64_dtype(data.dtype):
        return TimedeltaProperties(TimedeltaIndex(data, copy=copy,
                                                  freq='infer'), index,
                                   name=name, orig=orig)
    else:
        if is_period_arraylike(data):
            return PeriodProperties(PeriodIndex(data, copy=copy), index,
                                    name=name, orig=orig)
        if is_datetime_arraylike(data):
            return DatetimeProperties(DatetimeIndex(data, copy=copy,
                                                    freq='infer'), index,
                                      name=name, orig=orig)

    raise TypeError("cannot convert an object of type {0} to a "
                    "datetimelike index".format(type(data)))


class Properties(PandasDelegate, NoNewAttributesMixin):

    def __init__(self, values, index, name, orig=None):
        self.values = values
        self.index = index
        self.name = name
        self.orig = orig
        self._freeze()

    def _delegate_property_get(self, name):
        from pandas import Series

        result = getattr(self.values, name)

        # maybe need to upcast (ints)
        if isinstance(result, np.ndarray):
            if is_integer_dtype(result):
                result = result.astype('int64')
        elif not is_list_like(result):
            return result

        result = np.asarray(result)

        # blow up if we operate on categories
        if self.orig is not None:
            result = take_1d(result, self.orig.cat.codes)

        # return the result as a Series, which is by definition a copy
        result = Series(result, index=self.index, name=self.name)

        # setting this object will show a SettingWithCopyWarning/Error
        result.is_copy = ("modifications to a property of a datetimelike "
                          "object are not supported and are discarded. "
                          "Change values on the original.")

        return result

    def _delegate_property_set(self, name, value, *args, **kwargs):
        raise ValueError("modifications to a property of a datetimelike "
                         "object are not supported. Change values on the "
                         "original.")

    def _delegate_method(self, name, *args, **kwargs):
        from pandas import Series

        method = getattr(self.values, name)
        result = method(*args, **kwargs)

        if not is_list_like(result):
            return result

        result = Series(result, index=self.index, name=self.name)

        # setting this object will show a SettingWithCopyWarning/Error
        result.is_copy = ("modifications to a method of a datetimelike object "
                          "are not supported and are discarded. Change "
                          "values on the original.")

        return result


class DatetimeProperties(Properties):
    """
    Accessor object for datetimelike properties of the Series values.

    Examples
    --------
    >>> s.dt.hour
    >>> s.dt.second
    >>> s.dt.quarter

    Returns a Series indexed like the original Series.
    Raises TypeError if the Series does not contain datetimelike values.
    """

    def to_pydatetime(self):
        return self.values.to_pydatetime()


DatetimeProperties._add_delegate_accessors(
    delegate=DatetimeIndex,
    accessors=DatetimeIndex._datetimelike_ops,
    typ='property')
DatetimeProperties._add_delegate_accessors(
    delegate=DatetimeIndex,
    accessors=DatetimeIndex._datetimelike_methods,
    typ='method')


class TimedeltaProperties(Properties):
    """
    Accessor object for datetimelike properties of the Series values.

    Examples
    --------
    >>> s.dt.hours
    >>> s.dt.seconds

    Returns a Series indexed like the original Series.
    Raises TypeError if the Series does not contain datetimelike values.
    """

    def to_pytimedelta(self):
        return self.values.to_pytimedelta()

    @property
    def components(self):
        """
        Return a dataframe of the components (days, hours, minutes,
        seconds, milliseconds, microseconds, nanoseconds) of the Timedeltas.

        Returns
        -------
        a DataFrame

        """
        return self.values.components.set_index(self.index)


TimedeltaProperties._add_delegate_accessors(
    delegate=TimedeltaIndex,
    accessors=TimedeltaIndex._datetimelike_ops,
    typ='property')
TimedeltaProperties._add_delegate_accessors(
    delegate=TimedeltaIndex,
    accessors=TimedeltaIndex._datetimelike_methods,
    typ='method')


class PeriodProperties(Properties):
    """
    Accessor object for datetimelike properties of the Series values.

    Examples
    --------
    >>> s.dt.hour
    >>> s.dt.second
    >>> s.dt.quarter

    Returns a Series indexed like the original Series.
    Raises TypeError if the Series does not contain datetimelike values.
    """


PeriodProperties._add_delegate_accessors(
    delegate=PeriodIndex,
    accessors=PeriodIndex._datetimelike_ops,
    typ='property')
PeriodProperties._add_delegate_accessors(
    delegate=PeriodIndex,
    accessors=PeriodIndex._datetimelike_methods,
    typ='method')


class CombinedDatetimelikeProperties(DatetimeProperties, TimedeltaProperties):
    # This class is never instantiated, and exists solely for the benefit of
    # the Series.dt class property. For Series objects, .dt will always be one
    # of the more specific classes above.
    __doc__ = DatetimeProperties.__doc__
