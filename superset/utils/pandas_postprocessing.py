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
from typing import Any, Dict, List, Optional, Union

import numpy as np
from flask_babel import gettext as _
from pandas import DataFrame, NamedAgg

from superset.exceptions import NullValueException, SupersetException

SUPPORTED_NUMPY_FUNCTIONS = (
    "average",
    "argmin",
    "argmax",
    "cumsum",
    "cumprod",
    "max",
    "mean",
    "median",
    "nansum" "nanmin" "nanmax" "nanmean",
    "nanmedian",
    "min",
    "percentile",
    "prod",
    "product",
    "std",
    "sum",
    "var",
)


def _get_aggregate_funcs(aggregates: Dict[str, Dict[str, Any]],) -> Dict[str, NamedAgg]:
    """
    Converts a set of aggregate config objects into functions that pandas can use as
    aggregators. Currently only numpy aggregators are supported.

    :param aggregates: Mapping from column name to aggregat config.
    :return: Mapping from metric name to function that takes a single input argument.
    """
    agg_funcs: Dict[str, NamedAgg] = {}
    for name, agg_obj in aggregates.items():
        column = agg_obj.get("column", name)
        operator = agg_obj.get("operator") or "sum"
        if operator not in SUPPORTED_NUMPY_FUNCTIONS:
            raise SupersetException("Unsupported numpy function: %")
        func = getattr(np, operator)
        options = agg_obj.get("options", {})
        agg_funcs[name] = NamedAgg(column=column, aggfunc=partial(func, **options))

    return agg_funcs


def pivot(
    df: DataFrame,
    index: List[str],
    columns: List[str],
    aggregates: Dict[str, Dict[str, Any]],
    metric_fill_value: Optional[Any] = None,
    column_fill_value: Optional[str] = None,
    drop_missing_columns: Optional[bool] = True,
    combine_value_with_metric=False,
    marginal_distributions: Optional[bool] = None,
    marginal_distribution_name: Optional[str] = None,
) -> DataFrame:
    """
    Perform a pivot operation on a DataFrame.

    :param df: Object on which pivot operation will be performed
    :param index: Columns to group by on the table index (=rows)
    :param columns: Columns to group by on the table columns
    :param metric_fill_value: Value to replace missing values with
    :param column_fill_value: Value to replace missing pivot columns with
    :param drop_missing_columns: Do not include columns whose entries are all missing
    :param combine_value_with_metric: Display metrics side by side within each column,
           as opposed to each column being displayed side by side for each metric.
    :param aggregates: A mapping from aggregate column name to the the aggregate
           config.
    :param marginal_distributions: Add totals for row/column. Default to False
    :param marginal_distribution_name: Name of row/column with marginal distribution.
           Default to 'All'.
    :return: A pivot table
    """
    if not index:
        raise SupersetException(_("Pivot operation requires at least one index"))
    if not columns:
        raise SupersetException(_("Pivot operation requires at least one column"))
    if not aggregates:
        raise SupersetException(_("Pivot operation specifying aggregates"))

    if column_fill_value:
        df[columns] = df[columns].fillna(value=column_fill_value)

    aggregate_funcs = _get_aggregate_funcs(aggregates)

    # TODO (villebro): Pandas 1.0.3 doesn't yet support NamedAgg in pivot_table.
    #  Remove once support is added.
    aggfunc = {na.column: na.aggfunc for na in aggregate_funcs.values()}

    df = df.pivot_table(
        values=aggfunc.keys(),
        index=index,
        columns=columns,
        aggfunc=aggfunc,
        fill_value=metric_fill_value,
        dropna=drop_missing_columns,
        margins=marginal_distributions,
        margins_name=marginal_distribution_name,
    )

    if combine_value_with_metric:
        df = df.stack(0).unstack()

    return df


def aggregate(
    df: DataFrame, groupby: List[str], aggregates: Dict[str, Dict[str, Any]]
) -> DataFrame:
    """
    Apply aggregations to a DataFrame.

    :param df: Object to aggregate.
    :param groupby: columns to aggregate
    :param aggregates: A mapping from metric column to the function used to
           aggregate values.
    :return: Aggregated DataFrame
    """
    aggregates = aggregates or {}
    aggregate_funcs = _get_aggregate_funcs(aggregates)
    return df.groupby(by=groupby).agg(**aggregate_funcs)


def sort(df: DataFrame, by: Dict[str, bool]) -> DataFrame:
    """
    Sort a DataFrame.

    df: DataFrame to sort.
    by: columns by by which to sort. The key specifies the column name, value
        specifies if sorting in ascending order.
    """
    return df.sort_values(by=by.keys(), ascending=by.values())


def rolling(
    df: DataFrame,
    rolling_type: str,
    center: bool = False,
    win_type: Optional[str] = None,
    window: Optional[int] = None,
    min_periods: Optional[int] = None,
) -> DataFrame:
    """
    Apply a rolling window on the dataset. See the Pandas docs for further details:
    https://pandas.pydata.org/pandas-docs/stable/reference/api/pandas.DataFrame.rolling.html

    :param df: DataFrame on which the rolling period will be based.
    :param rolling_type: Type of rolling window. Any numpy function will work.
    :param center: Should the label be at the center of the window.
    :param win_type: Type of window function.
    :param window: Size of the window.
    :param min_periods:
    :return:
    """
    if rolling_type == "cumsum":
        df = df.cumsum()
    else:
        kwargs: Dict[str, Union[str, int]] = {}
        if window is not None:
            kwargs["window"] = window
        if min_periods is not None:
            kwargs["min_periods"] = min_periods
        if center is not None:
            kwargs["center"] = center
        if win_type is not None:
            kwargs["win_type"] = win_type

        df_rolling = df.rolling(**kwargs)
        if not hasattr(df_rolling, rolling_type):
            raise SupersetException(
                _("Unsupported rolling_type: %(type)s", type=rolling_type)
            )
        df = getattr(df_rolling, rolling_type)()

    if min_periods:
        df = df[min_periods:]
    return df
