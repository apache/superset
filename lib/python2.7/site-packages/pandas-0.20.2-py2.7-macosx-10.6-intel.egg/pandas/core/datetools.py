"""A collection of random tools for dealing with dates in Python"""

# flake8: noqa

import warnings

from pandas.core.tools.datetimes import *
from pandas.tseries.offsets import *
from pandas.tseries.frequencies import *

warnings.warn("The pandas.core.datetools module is deprecated and will be "
              "removed in a future version. Please use the pandas.tseries "
              "module instead.", FutureWarning, stacklevel=2)

day = DateOffset()
bday = BDay()
businessDay = bday
try:
    cday = CDay()
    customBusinessDay = CustomBusinessDay()
    customBusinessMonthEnd = CBMonthEnd()
    customBusinessMonthBegin = CBMonthBegin()
except NotImplementedError:
    cday = None
    customBusinessDay = None
    customBusinessMonthEnd = None
    customBusinessMonthBegin = None
monthEnd = MonthEnd()
yearEnd = YearEnd()
yearBegin = YearBegin()
bmonthEnd = BMonthEnd()
bmonthBegin = BMonthBegin()
cbmonthEnd = customBusinessMonthEnd
cbmonthBegin = customBusinessMonthBegin
bquarterEnd = BQuarterEnd()
quarterEnd = QuarterEnd()
byearEnd = BYearEnd()
week = Week()

# Functions/offsets to roll dates forward
thisMonthEnd = MonthEnd(0)
thisBMonthEnd = BMonthEnd(0)
thisYearEnd = YearEnd(0)
thisYearBegin = YearBegin(0)
thisBQuarterEnd = BQuarterEnd(0)
thisQuarterEnd = QuarterEnd(0)

# Functions to check where a date lies
isBusinessDay = BDay().onOffset
isMonthEnd = MonthEnd().onOffset
isBMonthEnd = BMonthEnd().onOffset
