# Licensed to the Apache Software Foundation (ASF) under one
# or more contributor license agreements.  See the NOTICE file
# distributed with this work for additional information
# regarding copyright ownership.  The ASF licenses this file
# to you under the Apache License, Version 2.0 (the
# "License"); you may not use this file except in compliance
# with the License.  You may obtain a copy of the License at
#
#   http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing,
# software distributed under the License is distributed on an
# "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
# KIND, either express or implied.  See the License for the
# specific language governing permissions and limitations
# under the License.
from collections.abc import Sequence
from functools import partial
from typing import Any, Callable

import numpy as np
import pandas as pd
from flask_babel import gettext as _
from pandas import DataFrame, NamedAgg

from superset.constants import TimeGrain
from superset.exceptions import InvalidPostProcessingError

NUMPY_FUNCTIONS: dict[str, Callable[..., Any]] = {
    "average": np.average,
    "argmin": np.argmin,
    "argmax": np.argmax,
    "count": np.ma.count,
    "count_nonzero": np.count_nonzero,
    "cumsum": np.cumsum,
    "cumprod": np.cumprod,
    "max": np.max,
    "mean": np.mean,
    "median": np.median,
    "nansum": np.nansum,
    "nanmin": np.nanmin,
    "nanmax": np.nanmax,
    "nanmean": np.nanmean,
    "nanmedian": np.nanmedian,
    "nanpercentile": np.nanpercentile,
    "min": np.min,
    "percentile": np.percentile,
    "prod": np.prod,
    "product": np.product,
    "std": np.std,
    "sum": np.sum,
    "var": np.var,
}

DENYLIST_ROLLING_FUNCTIONS = (
    "count",
    "corr",
    "cov",
    "kurt",
    "max",
    "mean",
    "median",
    "min",
    "std",
    "skew",
    "sum",
    "var",
    "quantile",
)

ALLOWLIST_CUMULATIVE_FUNCTIONS = (
    "cummax",
    "cummin",
    "cumprod",
    "cumsum",
)

PROPHET_TIME_GRAIN_MAP: dict[str, str] = {
    TimeGrain.SECOND: "S",
    TimeGrain.MINUTE: "min",
    TimeGrain.FIVE_MINUTES: "5min",
    TimeGrain.TEN_MINUTES: "10min",
    TimeGrain.FIFTEEN_MINUTES: "15min",
    TimeGrain.THIRTY_MINUTES: "30min",
    TimeGrain.HOUR: "H",
    TimeGrain.DAY: "D",
    TimeGrain.WEEK: "W",
    TimeGrain.MONTH: "M",
    TimeGrain.QUARTER: "Q",
    TimeGrain.YEAR: "A",
    TimeGrain.WEEK_STARTING_SUNDAY: "W-SUN",
    TimeGrain.WEEK_STARTING_MONDAY: "W-MON",
    TimeGrain.WEEK_ENDING_SATURDAY: "W-SAT",
    TimeGrain.WEEK_ENDING_SUNDAY: "W-SUN",
}

RESAMPLE_METHOD = ("asfreq", "bfill", "ffill", "linear", "median", "mean", "sum")

FLAT_COLUMN_SEPARATOR = ", "


def _is_multi_index_on_columns(df: DataFrame) -> bool:
    return isinstance(df.columns, pd.MultiIndex)


def scalar_to_sequence(val: Any) -> Sequence[str]:
    if val is None:
        return []
    if isinstance(val, str):
        return [val]
    return val


def validate_column_args(*argnames: str) -> Callable[..., Any]:
    def wrapper(func: Callable[..., Any]) -> Callable[..., Any]:
        def wrapped(df: DataFrame, **options: Any) -> Any:
            if _is_multi_index_on_columns(df):
                # MultiIndex column validate first level
                columns = df.columns.get_level_values(0)
            else:
                columns = df.columns.tolist()
            for name in argnames:
                if name in options and not all(
                    elem in columns for elem in scalar_to_sequence(options.get(name))
                ):
                    raise InvalidPostProcessingError(
                        _("Referenced columns not available in DataFrame.")
                    )
            return func(df, **options)

        return wrapped

    return wrapper


def _get_aggregate_funcs(
    df: DataFrame,
    aggregates: dict[str, dict[str, Any]],
) -> dict[str, NamedAgg]:
    """
    Converts a set of aggregate config objects into functions that pandas can use as
    aggregators. Currently only numpy aggregators are supported.

    :param df: DataFrame on which to perform aggregate operation.
    :param aggregates: Mapping from column name to aggregate config.
    :return: Mapping from metric name to function that takes a single input argument.
    """
    agg_funcs: dict[str, NamedAgg] = {}
    for name, agg_obj in aggregates.items():
        column = agg_obj.get("column", name)
        if column not in df:
            raise InvalidPostProcessingError(
                _(
                    "Column referenced by aggregate is undefined: %(column)s",
                    column=column,
                )
            )
        if "operator" not in agg_obj:
            raise InvalidPostProcessingError(
                _(
                    "Operator undefined for aggregator: %(name)s",
                    name=name,
                )
            )
        operator = agg_obj["operator"]
        if callable(operator):
            aggfunc = operator
        else:
            func = NUMPY_FUNCTIONS.get(operator)
            if not func:
                raise InvalidPostProcessingError(
                    _(
                        "Invalid numpy function: %(operator)s",
                        operator=operator,
                    )
                )
            options = agg_obj.get("options", {})
            aggfunc = partial(func, **options)
        agg_funcs[name] = NamedAgg(column=column, aggfunc=aggfunc)

    return agg_funcs


def _append_columns(
    base_df: DataFrame, append_df: DataFrame, columns: dict[str, str]
) -> DataFrame:
    """
    Function for adding columns from one DataFrame to another DataFrame. Calls the
    assign method, which overwrites the original column in `base_df` if the column
    already exists, and appends the column if the name is not defined.

    Note that! this is a memory-intensive operation.

    :param base_df: DataFrame which to use as the base
    :param append_df: DataFrame from which to select data.
    :param columns: columns on which to append, mapping source column to
           target column. For instance, `{'y': 'y'}` will replace the values in
           column `y` in `base_df` with the values in `y` in `append_df`,
           while `{'y': 'y2'}` will add a column `y2` to `base_df` based
           on values in column `y` in `append_df`, leaving the original column `y`
           in `base_df` unchanged.
    :return: new DataFrame with combined data from `base_df` and `append_df`
    """
    if all(key == value for key, value in columns.items()):
        # make sure to return a new DataFrame instead of changing the `base_df`.
        _base_df = base_df.copy()
        _base_df.loc[:, columns.keys()] = append_df
        return _base_df
    append_df = append_df.rename(columns=columns)
    return pd.concat([base_df, append_df], axis="columns")


def escape_separator(plain_str: str, sep: str = FLAT_COLUMN_SEPARATOR) -> str:
    char = sep.strip()
    return plain_str.replace(char, "\\" + char)


def unescape_separator(escaped_str: str, sep: str = FLAT_COLUMN_SEPARATOR) -> str:
    char = sep.strip()
    return escaped_str.replace("\\" + char, char)
