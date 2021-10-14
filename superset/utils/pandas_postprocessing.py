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
import logging
from decimal import Decimal
from functools import partial
from typing import Any, Callable, Dict, List, Optional, Set, Tuple, Union

import geohash as geohash_lib
import numpy as np
import pandas as pd
from flask_babel import gettext as _
from geopy.point import Point
from pandas import DataFrame, NamedAgg, Series, Timestamp

from superset.constants import NULL_STRING, PandasAxis, PandasPostprocessingCompare
from superset.exceptions import QueryObjectValidationError
from superset.utils.core import (
    DTTM_ALIAS,
    PostProcessingBoxplotWhiskerType,
    PostProcessingContributionOrientation,
    TIME_COMPARISION,
)

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
    "PT0.5H": "30min",
    "PT1H": "H",
    "P1D": "D",
    "P1W": "W",
    "P1M": "M",
    "P0.25Y": "Q",
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


@validate_column_args("index", "columns")
def pivot(  # pylint: disable=too-many-arguments,too-many-locals
    df: DataFrame,
    index: List[str],
    aggregates: Dict[str, Dict[str, Any]],
    columns: Optional[List[str]] = None,
    metric_fill_value: Optional[Any] = None,
    column_fill_value: Optional[str] = NULL_STRING,
    drop_missing_columns: Optional[bool] = True,
    combine_value_with_metric: bool = False,
    marginal_distributions: Optional[bool] = None,
    marginal_distribution_name: Optional[str] = None,
    flatten_columns: bool = True,
    reset_index: bool = True,
) -> DataFrame:
    """
    Perform a pivot operation on a DataFrame.

    :param df: Object on which pivot operation will be performed
    :param index: Columns to group by on the table index (=rows)
    :param columns: Columns to group by on the table columns
    :param metric_fill_value: Value to replace missing values with
    :param column_fill_value: Value to replace missing pivot columns with. By default
           replaces missing values with "<NULL>". Set to `None` to remove columns
           with missing values.
    :param drop_missing_columns: Do not include columns whose entries are all missing
    :param combine_value_with_metric: Display metrics side by side within each column,
           as opposed to each column being displayed side by side for each metric.
    :param aggregates: A mapping from aggregate column name to the the aggregate
           config.
    :param marginal_distributions: Add totals for row/column. Default to False
    :param marginal_distribution_name: Name of row/column with marginal distribution.
           Default to 'All'.
    :param flatten_columns: Convert column names to strings
    :param reset_index: Convert index to column
    :return: A pivot table
    :raises QueryObjectValidationError: If the request in incorrect
    """
    if not index:
        raise QueryObjectValidationError(
            _("Pivot operation requires at least one index")
        )
    if not aggregates:
        raise QueryObjectValidationError(
            _("Pivot operation must include at least one aggregate")
        )

    if columns and column_fill_value:
        df[columns] = df[columns].fillna(value=column_fill_value)

    aggregate_funcs = _get_aggregate_funcs(df, aggregates)

    # TODO (villebro): Pandas 1.0.3 doesn't yet support NamedAgg in pivot_table.
    #  Remove once/if support is added.
    aggfunc = {na.column: na.aggfunc for na in aggregate_funcs.values()}

    # When dropna = False, the pivot_table function will calculate cartesian-product
    # for MultiIndex.
    # https://github.com/apache/superset/issues/15956
    # https://github.com/pandas-dev/pandas/issues/18030
    series_set = set()
    if not drop_missing_columns and columns:
        for row in df[columns].itertuples():
            for metric in aggfunc.keys():
                series_set.add(str(tuple([metric]) + tuple(row[1:])))

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

    if not drop_missing_columns and len(series_set) > 0 and not df.empty:
        for col in df.columns:
            series = str(col)
            if series not in series_set:
                df = df.drop(col, axis=PandasAxis.COLUMN)

    if combine_value_with_metric:
        df = df.stack(0).unstack()

    # Make index regular column
    if flatten_columns:
        df.columns = [
            _flatten_column_after_pivot(col, aggregates) for col in df.columns
        ]
    # return index as regular column
    if reset_index:
        df.reset_index(level=0, inplace=True)
    return df


@validate_column_args("groupby")
def aggregate(
    df: DataFrame, groupby: List[str], aggregates: Dict[str, Dict[str, Any]]
) -> DataFrame:
    """
    Apply aggregations to a DataFrame.

    :param df: Object to aggregate.
    :param groupby: columns to aggregate
    :param aggregates: A mapping from metric column to the function used to
           aggregate values.
    :raises QueryObjectValidationError: If the request in incorrect
    """
    aggregates = aggregates or {}
    aggregate_funcs = _get_aggregate_funcs(df, aggregates)
    if groupby:
        df_groupby = df.groupby(by=groupby)
    else:
        df_groupby = df.groupby(lambda _: True)
    return df_groupby.agg(**aggregate_funcs).reset_index(drop=not groupby)


@validate_column_args("columns")
def sort(df: DataFrame, columns: Dict[str, bool]) -> DataFrame:
    """
    Sort a DataFrame.

    :param df: DataFrame to sort.
    :param columns: columns by by which to sort. The key specifies the column name,
           value specifies if sorting in ascending order.
    :return: Sorted DataFrame
    :raises QueryObjectValidationError: If the request in incorrect
    """
    return df.sort_values(by=list(columns.keys()), ascending=list(columns.values()))


@validate_column_args("columns")
def rolling(  # pylint: disable=too-many-arguments
    df: DataFrame,
    rolling_type: str,
    columns: Optional[Dict[str, str]] = None,
    window: Optional[int] = None,
    rolling_type_options: Optional[Dict[str, Any]] = None,
    center: bool = False,
    win_type: Optional[str] = None,
    min_periods: Optional[int] = None,
    is_pivot_df: bool = False,
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
    :param window: Size of the window.
    :param rolling_type_options: Optional options to pass to rolling method. Needed
           for e.g. quantile operation.
    :param center: Should the label be at the center of the window.
    :param win_type: Type of window function.
    :param min_periods: The minimum amount of periods required for a row to be included
                        in the result set.
    :param is_pivot_df: Dataframe is pivoted or not
    :return: DataFrame with the rolling columns
    :raises QueryObjectValidationError: If the request in incorrect
    """
    rolling_type_options = rolling_type_options or {}
    columns = columns or {}
    if is_pivot_df:
        df_rolling = df
    else:
        df_rolling = df[columns.keys()]
    kwargs: Dict[str, Union[str, int]] = {}
    if window is None:
        raise QueryObjectValidationError(_("Undefined window for rolling operation"))
    if window == 0:
        raise QueryObjectValidationError(_("Window must be > 0"))

    kwargs["window"] = window
    if min_periods is not None:
        kwargs["min_periods"] = min_periods
    if center is not None:
        kwargs["center"] = center
    if win_type is not None:
        kwargs["win_type"] = win_type

    df_rolling = df_rolling.rolling(**kwargs)
    if rolling_type not in DENYLIST_ROLLING_FUNCTIONS or not hasattr(
        df_rolling, rolling_type
    ):
        raise QueryObjectValidationError(
            _("Invalid rolling_type: %(type)s", type=rolling_type)
        )
    try:
        df_rolling = getattr(df_rolling, rolling_type)(**rolling_type_options)
    except TypeError as ex:
        raise QueryObjectValidationError(
            _(
                "Invalid options for %(rolling_type)s: %(options)s",
                rolling_type=rolling_type,
                options=rolling_type_options,
            )
        ) from ex

    if is_pivot_df:
        agg_in_pivot_df = df.columns.get_level_values(0).drop_duplicates().to_list()
        agg: Dict[str, Dict[str, Any]] = {col: {} for col in agg_in_pivot_df}
        df_rolling.columns = [
            _flatten_column_after_pivot(col, agg) for col in df_rolling.columns
        ]
        df_rolling.reset_index(level=0, inplace=True)
    else:
        df_rolling = _append_columns(df, df_rolling, columns)

    if min_periods:
        df_rolling = df_rolling[min_periods:]
    return df_rolling


@validate_column_args("columns", "drop", "rename")
def select(
    df: DataFrame,
    columns: Optional[List[str]] = None,
    exclude: Optional[List[str]] = None,
    rename: Optional[Dict[str, str]] = None,
) -> DataFrame:
    """
    Only select a subset of columns in the original dataset. Can be useful for
    removing unnecessary intermediate results, renaming and reordering columns.

    :param df: DataFrame on which the rolling period will be based.
    :param columns: Columns which to select from the DataFrame, in the desired order.
                    If left undefined, all columns will be selected. If columns are
                    renamed, the original column name should be referenced here.
    :param exclude: columns to exclude from selection. If columns are renamed, the new
                    column name should be referenced here.
    :param rename: columns which to rename, mapping source column to target column.
                   For instance, `{'y': 'y2'}` will rename the column `y` to
                   `y2`.
    :return: Subset of columns in original DataFrame
    :raises QueryObjectValidationError: If the request in incorrect
    """
    df_select = df.copy(deep=False)
    if columns:
        df_select = df_select[columns]
    if exclude:
        df_select = df_select.drop(exclude, axis=1)
    if rename is not None:
        df_select = df_select.rename(columns=rename)
    return df_select


@validate_column_args("columns")
def diff(
    df: DataFrame,
    columns: Dict[str, str],
    periods: int = 1,
    axis: PandasAxis = PandasAxis.ROW,
) -> DataFrame:
    """
    Calculate row-by-row or column-by-column difference for select columns.

    :param df: DataFrame on which the diff will be based.
    :param columns: columns on which to perform diff, mapping source column to
           target column. For instance, `{'y': 'y'}` will replace the column `y` with
           the diff value in `y`, while `{'y': 'y2'}` will add a column `y2` based
           on diff values calculated from `y`, leaving the original column `y`
           unchanged.
    :param periods: periods to shift for calculating difference.
    :param axis: 0 for row, 1 for column. default 0.
    :return: DataFrame with diffed columns
    :raises QueryObjectValidationError: If the request in incorrect
    """
    df_diff = df[columns.keys()]
    df_diff = df_diff.diff(periods=periods, axis=axis)
    return _append_columns(df, df_diff, columns)


@validate_column_args("source_columns", "compare_columns")
def compare(  # pylint: disable=too-many-arguments
    df: DataFrame,
    source_columns: List[str],
    compare_columns: List[str],
    compare_type: Optional[PandasPostprocessingCompare],
    drop_original_columns: Optional[bool] = False,
    precision: Optional[int] = 4,
) -> DataFrame:
    """
    Calculate column-by-column changing for select columns.

    :param df: DataFrame on which the compare will be based.
    :param source_columns: Main query columns
    :param compare_columns: Columns being compared
    :param compare_type: Type of compare. Choice of `absolute`, `percentage` or `ratio`
    :param drop_original_columns: Whether to remove the source columns and
           compare columns.
    :param precision: Round a change rate to a variable number of decimal places.
    :return: DataFrame with compared columns.
    :raises QueryObjectValidationError: If the request in incorrect.
    """
    if len(source_columns) != len(compare_columns):
        raise QueryObjectValidationError(
            _("`compare_columns` must have the same length as `source_columns`.")
        )
    if compare_type not in tuple(PandasPostprocessingCompare):
        raise QueryObjectValidationError(
            _("`compare_type` must be `difference`, `percentage` or `ratio`")
        )
    if len(source_columns) == 0:
        return df

    for s_col, c_col in zip(source_columns, compare_columns):
        if compare_type == PandasPostprocessingCompare.DIFF:
            diff_series = df[s_col] - df[c_col]
        elif compare_type == PandasPostprocessingCompare.PCT:
            diff_series = (
                ((df[s_col] - df[c_col]) / df[c_col]).astype(float).round(precision)
            )
        else:
            # compare_type == "ratio"
            diff_series = (df[s_col] / df[c_col]).astype(float).round(precision)
        diff_df = diff_series.to_frame(
            name=TIME_COMPARISION.join([compare_type, s_col, c_col])
        )
        df = pd.concat([df, diff_df], axis=1)

    if drop_original_columns:
        df = df.drop(source_columns + compare_columns, axis=1)
    return df


@validate_column_args("columns")
def cum(
    df: DataFrame,
    operator: str,
    columns: Optional[Dict[str, str]] = None,
    is_pivot_df: bool = False,
) -> DataFrame:
    """
    Calculate cumulative sum/product/min/max for select columns.

    :param df: DataFrame on which the cumulative operation will be based.
    :param columns: columns on which to perform a cumulative operation, mapping source
           column to target column. For instance, `{'y': 'y'}` will replace the column
           `y` with the cumulative value in `y`, while `{'y': 'y2'}` will add a column
           `y2` based on cumulative values calculated from `y`, leaving the original
           column `y` unchanged.
    :param operator: cumulative operator, e.g. `sum`, `prod`, `min`, `max`
    :param is_pivot_df: Dataframe is pivoted or not
    :return: DataFrame with cumulated columns
    """
    columns = columns or {}
    if is_pivot_df:
        df_cum = df
    else:
        df_cum = df[columns.keys()]
    operation = "cum" + operator
    if operation not in ALLOWLIST_CUMULATIVE_FUNCTIONS or not hasattr(
        df_cum, operation
    ):
        raise QueryObjectValidationError(
            _("Invalid cumulative operator: %(operator)s", operator=operator)
        )
    if is_pivot_df:
        df_cum = getattr(df_cum, operation)()
        agg_in_pivot_df = df.columns.get_level_values(0).drop_duplicates().to_list()
        agg: Dict[str, Dict[str, Any]] = {col: {} for col in agg_in_pivot_df}
        df_cum.columns = [
            _flatten_column_after_pivot(col, agg) for col in df_cum.columns
        ]
        df_cum.reset_index(level=0, inplace=True)
    else:
        df_cum = _append_columns(df, getattr(df_cum, operation)(), columns)
    return df_cum


def geohash_decode(
    df: DataFrame, geohash: str, longitude: str, latitude: str
) -> DataFrame:
    """
    Decode a geohash column into longitude and latitude

    :param df: DataFrame containing geohash data
    :param geohash: Name of source column containing geohash location.
    :param longitude: Name of new column to be created containing longitude.
    :param latitude: Name of new column to be created containing latitude.
    :return: DataFrame with decoded longitudes and latitudes
    """
    try:
        lonlat_df = DataFrame()
        lonlat_df["latitude"], lonlat_df["longitude"] = zip(
            *df[geohash].apply(geohash_lib.decode)
        )
        return _append_columns(
            df, lonlat_df, {"latitude": latitude, "longitude": longitude}
        )
    except ValueError as ex:
        raise QueryObjectValidationError(_("Invalid geohash string")) from ex


def geohash_encode(
    df: DataFrame, geohash: str, longitude: str, latitude: str,
) -> DataFrame:
    """
    Encode longitude and latitude into geohash

    :param df: DataFrame containing longitude and latitude data
    :param geohash: Name of new column to be created containing geohash location.
    :param longitude: Name of source column containing longitude.
    :param latitude: Name of source column containing latitude.
    :return: DataFrame with decoded longitudes and latitudes
    """
    try:
        encode_df = df[[latitude, longitude]]
        encode_df.columns = ["latitude", "longitude"]
        encode_df["geohash"] = encode_df.apply(
            lambda row: geohash_lib.encode(row["latitude"], row["longitude"]), axis=1,
        )
        return _append_columns(df, encode_df, {"geohash": geohash})
    except ValueError as ex:
        raise QueryObjectValidationError(_("Invalid longitude/latitude")) from ex


def geodetic_parse(
    df: DataFrame,
    geodetic: str,
    longitude: str,
    latitude: str,
    altitude: Optional[str] = None,
) -> DataFrame:
    """
    Parse a column containing a geodetic point string
    [Geopy](https://geopy.readthedocs.io/en/stable/#geopy.point.Point).

    :param df: DataFrame containing geodetic point data
    :param geodetic: Name of source column containing geodetic point string.
    :param longitude: Name of new column to be created containing longitude.
    :param latitude: Name of new column to be created containing latitude.
    :param altitude: Name of new column to be created containing altitude.
    :return: DataFrame with decoded longitudes and latitudes
    """

    def _parse_location(location: str) -> Tuple[float, float, float]:
        """
        Parse a string containing a geodetic point and return latitude, longitude
        and altitude
        """
        point = Point(location)
        return point[0], point[1], point[2]

    try:
        geodetic_df = DataFrame()
        (
            geodetic_df["latitude"],
            geodetic_df["longitude"],
            geodetic_df["altitude"],
        ) = zip(*df[geodetic].apply(_parse_location))
        columns = {"latitude": latitude, "longitude": longitude}
        if altitude:
            columns["altitude"] = altitude
        return _append_columns(df, geodetic_df, columns)
    except ValueError as ex:
        raise QueryObjectValidationError(_("Invalid geodetic string")) from ex


@validate_column_args("columns")
def contribution(
    df: DataFrame,
    orientation: Optional[
        PostProcessingContributionOrientation
    ] = PostProcessingContributionOrientation.COLUMN,
    columns: Optional[List[str]] = None,
    rename_columns: Optional[List[str]] = None,
) -> DataFrame:
    """
    Calculate cell contibution to row/column total for numeric columns.
    Non-numeric columns will be kept untouched.

    If `columns` are specified, only calculate contributions on selected columns.

    :param df: DataFrame containing all-numeric data (temporal column ignored)
    :param columns: Columns to calculate values from.
    :param rename_columns: The new labels for the calculated contribution columns.
                           The original columns will not be removed.
    :param orientation: calculate by dividing cell with row/column total
    :return: DataFrame with contributions.
    """
    contribution_df = df.copy()
    numeric_df = contribution_df.select_dtypes(include=["number", Decimal])
    # verify column selections
    if columns:
        numeric_columns = numeric_df.columns.tolist()
        for col in columns:
            if col not in numeric_columns:
                raise QueryObjectValidationError(
                    _(
                        'Column "%(column)s" is not numeric or does not '
                        "exists in the query results.",
                        column=col,
                    )
                )
    columns = columns or numeric_df.columns
    rename_columns = rename_columns or columns
    if len(rename_columns) != len(columns):
        raise QueryObjectValidationError(
            _("`rename_columns` must have the same length as `columns`.")
        )
    # limit to selected columns
    numeric_df = numeric_df[columns]
    axis = 0 if orientation == PostProcessingContributionOrientation.COLUMN else 1
    numeric_df = numeric_df / numeric_df.values.sum(axis=axis, keepdims=True)
    contribution_df[rename_columns] = numeric_df
    return contribution_df


def _prophet_parse_seasonality(
    input_value: Optional[Union[bool, int]]
) -> Union[bool, str, int]:
    if input_value is None:
        return "auto"
    if isinstance(input_value, bool):
        return input_value
    try:
        return int(input_value)
    except ValueError:
        return input_value


def _prophet_fit_and_predict(  # pylint: disable=too-many-arguments
    df: DataFrame,
    confidence_interval: float,
    yearly_seasonality: Union[bool, str, int],
    weekly_seasonality: Union[bool, str, int],
    daily_seasonality: Union[bool, str, int],
    periods: int,
    freq: str,
) -> DataFrame:
    """
    Fit a prophet model and return a DataFrame with predicted results.
    """
    try:
        # pylint: disable=import-error,import-outside-toplevel
        from prophet import Prophet

        prophet_logger = logging.getLogger("prophet.plot")
        prophet_logger.setLevel(logging.CRITICAL)
        prophet_logger.setLevel(logging.NOTSET)
    except ModuleNotFoundError as ex:
        raise QueryObjectValidationError(_("`prophet` package not installed")) from ex
    model = Prophet(
        interval_width=confidence_interval,
        yearly_seasonality=yearly_seasonality,
        weekly_seasonality=weekly_seasonality,
        daily_seasonality=daily_seasonality,
    )
    if df["ds"].dt.tz:
        df["ds"] = df["ds"].dt.tz_convert(None)
    model.fit(df)
    future = model.make_future_dataframe(periods=periods, freq=freq)
    forecast = model.predict(future)[["ds", "yhat", "yhat_lower", "yhat_upper"]]
    return forecast.join(df.set_index("ds"), on="ds").set_index(["ds"])


def prophet(  # pylint: disable=too-many-arguments
    df: DataFrame,
    time_grain: str,
    periods: int,
    confidence_interval: float,
    yearly_seasonality: Optional[Union[bool, int]] = None,
    weekly_seasonality: Optional[Union[bool, int]] = None,
    daily_seasonality: Optional[Union[bool, int]] = None,
) -> DataFrame:
    """
    Add forecasts to each series in a timeseries dataframe, along with confidence
    intervals for the prediction. For each series, the operation creates three
    new columns with the column name suffixed with the following values:

    - `__yhat`: the forecast for the given date
    - `__yhat_lower`: the lower bound of the forecast for the given date
    - `__yhat_upper`: the upper bound of the forecast for the given date


    :param df: DataFrame containing all-numeric data (temporal column ignored)
    :param time_grain: Time grain used to specify time period increments in prediction
    :param periods: Time periods (in units of `time_grain`) to predict into the future
    :param confidence_interval: Width of predicted confidence interval
    :param yearly_seasonality: Should yearly seasonality be applied.
           An integer value will specify Fourier order of seasonality.
    :param weekly_seasonality: Should weekly seasonality be applied.
           An integer value will specify Fourier order of seasonality, `None` will
           automatically detect seasonality.
    :param daily_seasonality: Should daily seasonality be applied.
           An integer value will specify Fourier order of seasonality, `None` will
           automatically detect seasonality.
    :return: DataFrame with contributions, with temporal column at beginning if present
    """
    # validate inputs
    if not time_grain:
        raise QueryObjectValidationError(_("Time grain missing"))
    if time_grain not in PROPHET_TIME_GRAIN_MAP:
        raise QueryObjectValidationError(
            _("Unsupported time grain: %(time_grain)s", time_grain=time_grain,)
        )
    freq = PROPHET_TIME_GRAIN_MAP[time_grain]
    # check type at runtime due to marhsmallow schema not being able to handle
    # union types
    if not periods or periods < 0 or not isinstance(periods, int):
        raise QueryObjectValidationError(_("Periods must be a positive integer value"))
    if not confidence_interval or confidence_interval <= 0 or confidence_interval >= 1:
        raise QueryObjectValidationError(
            _("Confidence interval must be between 0 and 1 (exclusive)")
        )
    if DTTM_ALIAS not in df.columns:
        raise QueryObjectValidationError(_("DataFrame must include temporal column"))
    if len(df.columns) < 2:
        raise QueryObjectValidationError(_("DataFrame include at least one series"))

    target_df = DataFrame()
    for column in [column for column in df.columns if column != DTTM_ALIAS]:
        fit_df = _prophet_fit_and_predict(
            df=df[[DTTM_ALIAS, column]].rename(columns={DTTM_ALIAS: "ds", column: "y"}),
            confidence_interval=confidence_interval,
            yearly_seasonality=_prophet_parse_seasonality(yearly_seasonality),
            weekly_seasonality=_prophet_parse_seasonality(weekly_seasonality),
            daily_seasonality=_prophet_parse_seasonality(daily_seasonality),
            periods=periods,
            freq=freq,
        )
        new_columns = [
            f"{column}__yhat",
            f"{column}__yhat_lower",
            f"{column}__yhat_upper",
            f"{column}",
        ]
        fit_df.columns = new_columns
        if target_df.empty:
            target_df = fit_df
        else:
            for new_column in new_columns:
                target_df = target_df.assign(**{new_column: fit_df[new_column]})
    target_df.reset_index(level=0, inplace=True)
    return target_df.rename(columns={"ds": DTTM_ALIAS})


def boxplot(
    df: DataFrame,
    groupby: List[str],
    metrics: List[str],
    whisker_type: PostProcessingBoxplotWhiskerType,
    percentiles: Optional[
        Union[List[Union[int, float]], Tuple[Union[int, float], Union[int, float]]]
    ] = None,
) -> DataFrame:
    """
    Calculate boxplot statistics. For each metric, the operation creates eight
    new columns with the column name suffixed with the following values:

    - `__mean`: the mean
    - `__median`: the median
    - `__max`: the maximum value excluding outliers (see whisker type)
    - `__min`: the minimum value excluding outliers (see whisker type)
    - `__q1`: the median
    - `__q1`: the first quartile (25th percentile)
    - `__q3`: the third quartile (75th percentile)
    - `__count`: count of observations
    - `__outliers`: the values that fall outside the minimum/maximum value
                    (see whisker type)

    :param df: DataFrame containing all-numeric data (temporal column ignored)
    :param groupby: The categories to group by (x-axis)
    :param metrics: The metrics for which to calculate the distribution
    :param whisker_type: The confidence level type
    :return: DataFrame with boxplot statistics per groupby
    """

    def quartile1(series: Series) -> float:
        return np.nanpercentile(series, 25, interpolation="midpoint")

    def quartile3(series: Series) -> float:
        return np.nanpercentile(series, 75, interpolation="midpoint")

    if whisker_type == PostProcessingBoxplotWhiskerType.TUKEY:

        def whisker_high(series: Series) -> float:
            upper_outer_lim = quartile3(series) + 1.5 * (
                quartile3(series) - quartile1(series)
            )
            return series[series <= upper_outer_lim].max()

        def whisker_low(series: Series) -> float:
            lower_outer_lim = quartile1(series) - 1.5 * (
                quartile3(series) - quartile1(series)
            )
            return series[series >= lower_outer_lim].min()

    elif whisker_type == PostProcessingBoxplotWhiskerType.PERCENTILE:
        if (
            not isinstance(percentiles, (list, tuple))
            or len(percentiles) != 2
            or not isinstance(percentiles[0], (int, float))
            or not isinstance(percentiles[1], (int, float))
            or percentiles[0] >= percentiles[1]
        ):
            raise QueryObjectValidationError(
                _(
                    "percentiles must be a list or tuple with two numeric values, "
                    "of which the first is lower than the second value"
                )
            )
        low, high = percentiles[0], percentiles[1]

        def whisker_high(series: Series) -> float:
            return np.nanpercentile(series, high)

        def whisker_low(series: Series) -> float:
            return np.nanpercentile(series, low)

    else:
        whisker_high = np.max
        whisker_low = np.min

    def outliers(series: Series) -> Set[float]:
        above = series[series > whisker_high(series)]
        below = series[series < whisker_low(series)]
        return above.tolist() + below.tolist()

    operators: Dict[str, Callable[[Any], Any]] = {
        "mean": np.mean,
        "median": np.median,
        "max": whisker_high,
        "min": whisker_low,
        "q1": quartile1,
        "q3": quartile3,
        "count": np.ma.count,
        "outliers": outliers,
    }
    aggregates: Dict[str, Dict[str, Union[str, Callable[..., Any]]]] = {
        f"{metric}__{operator_name}": {"column": metric, "operator": operator}
        for operator_name, operator in operators.items()
        for metric in metrics
    }
    return aggregate(df, groupby=groupby, aggregates=aggregates)


def resample(
    df: DataFrame,
    rule: str,
    method: str,
    time_column: str,
    fill_value: Optional[Union[float, int]] = None,
) -> DataFrame:
    """
    resample a timeseries dataframe.

    :param df: DataFrame to resample.
    :param rule: The offset string representing target conversion.
    :param method: How to fill the NaN value after resample.
    :param time_column: existing columns in DataFrame.
    :param fill_value: What values do fill missing.
    :return: DataFrame after resample
    :raises QueryObjectValidationError: If the request in incorrect
    """
    df = df.set_index(time_column)
    if method == "asfreq" and fill_value is not None:
        df = df.resample(rule).asfreq(fill_value=fill_value)
    else:
        df = getattr(df.resample(rule), method)()
    return df.reset_index()
