"""This module is designed for community supported date conversion functions"""
from pandas.compat import range, map
import numpy as np
import pandas._libs.lib as lib


def parse_date_time(date_col, time_col):
    date_col = _maybe_cast(date_col)
    time_col = _maybe_cast(time_col)
    return lib.try_parse_date_and_time(date_col, time_col)


def parse_date_fields(year_col, month_col, day_col):
    year_col = _maybe_cast(year_col)
    month_col = _maybe_cast(month_col)
    day_col = _maybe_cast(day_col)
    return lib.try_parse_year_month_day(year_col, month_col, day_col)


def parse_all_fields(year_col, month_col, day_col, hour_col, minute_col,
                     second_col):
    year_col = _maybe_cast(year_col)
    month_col = _maybe_cast(month_col)
    day_col = _maybe_cast(day_col)
    hour_col = _maybe_cast(hour_col)
    minute_col = _maybe_cast(minute_col)
    second_col = _maybe_cast(second_col)
    return lib.try_parse_datetime_components(year_col, month_col, day_col,
                                             hour_col, minute_col, second_col)


def generic_parser(parse_func, *cols):
    N = _check_columns(cols)
    results = np.empty(N, dtype=object)

    for i in range(N):
        args = [c[i] for c in cols]
        results[i] = parse_func(*args)

    return results


def _maybe_cast(arr):
    if not arr.dtype.type == np.object_:
        arr = np.array(arr, dtype=object)
    return arr


def _check_columns(cols):
    if not len(cols):
        raise AssertionError("There must be at least 1 column")

    head, tail = cols[0], cols[1:]

    N = len(head)

    for i, n in enumerate(map(len, tail)):
        if n != N:
            raise AssertionError('All columns must have the same length: {0}; '
                                 'column {1} has length {2}'.format(N, i, n))

    return N
