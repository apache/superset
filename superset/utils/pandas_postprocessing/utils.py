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
from functools import partial
from typing import Any, Callable, Dict, Tuple, Union

import numpy as np
from flask_babel import gettext as _
from pandas import DataFrame, NamedAgg, Timestamp

from superset.exceptions import QueryObjectValidationError

NUMPY_FUNCTIONS = {
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

PROPHET_TIME_GRAIN_MAP = {
    "PT1S": "S",
    "PT1M": "min",
    "PT5M": "5min",
    "PT10M": "10min",
    "PT15M": "15min",
    "PT30M": "30min",
    "PT1H": "H",
    "P1D": "D",
    "P1W": "W",
    "P1M": "M",
    "P3M": "Q",
    "P1Y": "A",
    "1969-12-28T00:00:00Z/P1W": "W",
    "1969-12-29T00:00:00Z/P1W": "W",
    "P1W/1970-01-03T00:00:00Z": "W",
    "P1W/1970-01-04T00:00:00Z": "W",
}


def _flatten_column_after_pivot(
    column: Union[float, Timestamp, str, Tuple[str, ...]],
    aggregates: Dict[str, Dict[str, Any]],
) -> str:
    """
    Function for flattening column names into a single string. This step is necessary
    to be able to properly serialize a DataFrame. If the column is a string, return
    element unchanged. For multi-element columns, join column elements with a comma,
    with the exception of pivots made with a single aggregate, in which case the
    aggregate column name is omitted.

    :param column: single element from `DataFrame.columns`
    :param aggregates: aggregates
    :return:
    """
    if not isinstance(column, tuple):
        column = (column,)
    if len(aggregates) == 1 and len(column) > 1:
        # drop aggregate for single aggregate pivots with multiple groupings
        # from column name (aggregates always come first in column name)
        column = column[1:]
    return ", ".join([str(col) for col in column])


def validate_column_args(*argnames: str) -> Callable[..., Any]:
    def wrapper(func: Callable[..., Any]) -> Callable[..., Any]:
        def wrapped(df: DataFrame, **options: Any) -> Any:
            if options.get("is_pivot_df"):
                # skip validation when pivot Dataframe
                return func(df, **options)
            columns = df.columns.tolist()
            for name in argnames:
                if name in options and not all(
                    elem in columns for elem in options.get(name) or []
                ):
                    raise QueryObjectValidationError(
                        _("Referenced columns not available in DataFrame.")
                    )
            return func(df, **options)

        return wrapped

    return wrapper


def _get_aggregate_funcs(
    df: DataFrame, aggregates: Dict[str, Dict[str, Any]],
) -> Dict[str, NamedAgg]:
    """
    Converts a set of aggregate config objects into functions that pandas can use as
    aggregators. Currently only numpy aggregators are supported.

    :param df: DataFrame on which to perform aggregate operation.
    :param aggregates: Mapping from column name to aggregate config.
    :return: Mapping from metric name to function that takes a single input argument.
    """
    agg_funcs: Dict[str, NamedAgg] = {}
    for name, agg_obj in aggregates.items():
        column = agg_obj.get("column", name)
        if column not in df:
            raise QueryObjectValidationError(
                _(
                    "Column referenced by aggregate is undefined: %(column)s",
                    column=column,
                )
            )
        if "operator" not in agg_obj:
            raise QueryObjectValidationError(
                _("Operator undefined for aggregator: %(name)s", name=name,)
            )
        operator = agg_obj["operator"]
        if callable(operator):
            aggfunc = operator
        else:
            func = NUMPY_FUNCTIONS.get(operator)
            if not func:
                raise QueryObjectValidationError(
                    _("Invalid numpy function: %(operator)s", operator=operator,)
                )
            options = agg_obj.get("options", {})
            aggfunc = partial(func, **options)
        agg_funcs[name] = NamedAgg(column=column, aggfunc=aggfunc)

    return agg_funcs


def _append_columns(
    base_df: DataFrame, append_df: DataFrame, columns: Dict[str, str]
) -> DataFrame:
    """
    Function for adding columns from one DataFrame to another DataFrame. Calls the
    assign method, which overwrites the original column in `base_df` if the column
    already exists, and appends the column if the name is not defined.

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
    return base_df.assign(
        **{target: append_df[source] for source, target in columns.items()}
    )
