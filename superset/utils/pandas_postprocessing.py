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

from superset.exceptions import SupersetException

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
        **{
            target: append_df[append_df.columns[idx]]
            for idx, target in enumerate(columns.values())
        }
    )


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


def sort(df: DataFrame, columns: Dict[str, bool]) -> DataFrame:
    """
    Sort a DataFrame.

    :param df: DataFrame to sort.
    :param by: columns by by which to sort. The key specifies the column name, value
               specifies if sorting in ascending order.
    :return: Sorted DataFrame
    """
    return df.sort_values(by=list(columns.keys()), ascending=list(columns.values()))


def rolling(
    df: DataFrame,
    columns: Dict[str, str],
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
    :param columns: columns on which to perform rolling, mapping source column to
           target column. For instance, `{'y': 'y'}` will replace the column `y` with
           the rolling value in `y`, while `{'y': 'y2'}` will add a column `y2` based
           on rolling values calculated from `y`, leaving the original column `y`
           unchanged.
    :param rolling_type: Type of rolling window. Any numpy function will work.
    :param center: Should the label be at the center of the window.
    :param win_type: Type of window function.
    :param window: Size of the window.
    :param min_periods:
    :return: DataFrame with the rolling columns
    """
    df_rolling = df[columns.keys()]
    if rolling_type == "cumsum":
        df_rolling = df_rolling.cumsum()
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

        df_rolling = df_rolling.rolling(**kwargs)
        if not hasattr(df_rolling, rolling_type):
            raise SupersetException(
                _("Unsupported rolling_type: %(type)s", type=rolling_type)
            )
        df_rolling = getattr(df_rolling, rolling_type)()
    df = _append_columns(df, df_rolling, columns)
    if min_periods:
        df = df[min_periods:]
    return df


def select(df: DataFrame, columns: Dict[str, str],) -> DataFrame:
    """
    Only select a subset of columns in the original dataset. Can be useful for
    removing unnecessary intermediate results, renaming and reordering columns.

    :param df: DataFrame on which the rolling period will be based.
    :param columns: Columns on which to perform dff, mapping the
                    column name to its alias. For instance, `{'y': 'y'}` will return
                    a DataFrame with only the contents of column `y`,
                    while `{'y': 'y2'}` return a DataFrame with the column `y2`
                    containing the values from column `y`.
    :return: Subset of columns in original DataFrame
    """
    return df[columns.keys()].rename(columns=columns)


def diff(df: DataFrame, columns: Dict[str, str], periods: int = 1,) -> DataFrame:
    """

    :param df: DataFrame on which the rolling period will be based.
    :param columns: columns on which to perform diff, mapping source column to
           target column. For instance, `{'y': 'y'}` will replace the column `y` with
           the rollong value in `y`, while `{'y': 'y2'}` will add a column `y2` based
           on rolling values calculated from `y`, leaving the original column `y`
           unchanged.
    :param periods:
    :return:
    """
    df_diff = df[columns.keys()]
    df_diff = df_diff.diff(periods=periods)
    return _append_columns(df, df_diff, columns)
