
# pylint: disable=W0614,W0401,W0611
# flake8: noqa

import numpy as np

from pandas.core.algorithms import factorize, unique, value_counts
from pandas.core.dtypes.missing import isnull, notnull
from pandas.core.categorical import Categorical
from pandas.core.groupby import Grouper
from pandas.io.formats.format import set_eng_float_format
from pandas.core.index import (Index, CategoricalIndex, Int64Index,
                               UInt64Index, RangeIndex, Float64Index,
                               MultiIndex, IntervalIndex,
                               TimedeltaIndex, DatetimeIndex,
                               PeriodIndex, NaT)
from pandas.core.indexes.period import Period, period_range, pnow
from pandas.core.indexes.timedeltas import Timedelta, timedelta_range
from pandas.core.indexes.datetimes import Timestamp, date_range, bdate_range
from pandas.core.indexes.interval import Interval, interval_range

from pandas.core.series import Series
from pandas.core.frame import DataFrame
from pandas.core.panel import Panel, WidePanel
from pandas.core.panel4d import Panel4D
from pandas.core.reshape.reshape import (
    pivot_simple as pivot, get_dummies,
    lreshape, wide_to_long)

from pandas.core.indexing import IndexSlice
from pandas.core.tools.numeric import to_numeric
from pandas.tseries.offsets import DateOffset
from pandas.core.tools.datetimes import to_datetime
from pandas.core.tools.timedeltas import to_timedelta
from pandas.core.resample import TimeGrouper

# see gh-14094.
from pandas.util._depr_module import _DeprecatedModule

_removals = ['day', 'bday', 'businessDay', 'cday', 'customBusinessDay',
             'customBusinessMonthEnd', 'customBusinessMonthBegin',
             'monthEnd', 'yearEnd', 'yearBegin', 'bmonthEnd', 'bmonthBegin',
             'cbmonthEnd', 'cbmonthBegin', 'bquarterEnd', 'quarterEnd',
             'byearEnd', 'week']
datetools = _DeprecatedModule(deprmod='pandas.core.datetools',
                              removals=_removals)

from pandas.core.config import (get_option, set_option, reset_option,
                                describe_option, option_context, options)


# deprecation, xref #13790
def match(*args, **kwargs):
    import warnings

    warnings.warn("pd.match() is deprecated and will be removed "
                  "in a future version",
                  FutureWarning, stacklevel=2)
    from pandas.core.algorithms import match
    return match(*args, **kwargs)


def groupby(*args, **kwargs):
    import warnings

    warnings.warn("pd.groupby() is deprecated and will be removed "
                  "Please use the Series.groupby() or "
                  "DataFrame.groupby() methods",
                  FutureWarning, stacklevel=2)
    return args[0].groupby(*args[1:], **kwargs)
