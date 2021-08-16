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
"""
Functions to reproduce the post-processing of data on text charts.

Some text-based charts (pivot tables and t-test table) perform
post-processing of the data in Javascript. When sending the data
to users in reports we want to show the same data they would see
on Explore.

In order to do that, we reproduce the post-processing in Python
for these chart types.
"""

from io import StringIO
from typing import Any, Callable, Dict, Optional, Union

import pandas as pd

from superset.utils.core import DTTM_ALIAS, extract_dataframe_dtypes, get_metric_name


def sql_like_sum(series: pd.Series) -> pd.Series:
    """
    A SUM aggregation function that mimics the behavior from SQL.
    """
    return series.sum(min_count=1)


def pivot_table(df: pd.DataFrame, form_data: Dict[str, Any]) -> pd.DataFrame:
    """
    Pivot table.
    """
    if form_data.get("granularity") == "all" and DTTM_ALIAS in df:
        del df[DTTM_ALIAS]

    metrics = [get_metric_name(m) for m in form_data["metrics"]]
    aggfuncs: Dict[str, Union[str, Callable[[Any], Any]]] = {}
    for metric in metrics:
        aggfunc = form_data.get("pandas_aggfunc") or "sum"
        if pd.api.types.is_numeric_dtype(df[metric]):
            if aggfunc == "sum":
                aggfunc = sql_like_sum
        elif aggfunc not in {"min", "max"}:
            aggfunc = "max"
        aggfuncs[metric] = aggfunc

    groupby = form_data.get("groupby") or []
    columns = form_data.get("columns") or []
    if form_data.get("transpose_pivot"):
        groupby, columns = columns, groupby

    df = df.pivot_table(
        index=groupby,
        columns=columns,
        values=metrics,
        aggfunc=aggfuncs,
        margins=form_data.get("pivot_margins"),
    )

    # Display metrics side by side with each column
    if form_data.get("combine_metric"):
        df = df.stack(0).unstack().reindex(level=-1, columns=metrics)

    # flatten column names
    df.columns = [
        " ".join(str(name) for name in column) if isinstance(column, tuple) else column
        for column in df.columns
    ]

    return df


def list_unique_values(series: pd.Series) -> str:
    """
    List unique values in a series.
    """
    return ", ".join(set(str(v) for v in pd.Series.unique(series)))


pivot_v2_aggfunc_map = {
    "Count": pd.Series.count,
    "Count Unique Values": pd.Series.nunique,
    "List Unique Values": list_unique_values,
    "Sum": pd.Series.sum,
    "Average": pd.Series.mean,
    "Median": pd.Series.median,
    "Sample Variance": lambda series: pd.series.var(series) if len(series) > 1 else 0,
    "Sample Standard Deviation": (
        lambda series: pd.series.std(series) if len(series) > 1 else 0,
    ),
    "Minimum": pd.Series.min,
    "Maximum": pd.Series.max,
    "First": lambda series: series[:1],
    "Last": lambda series: series[-1:],
    "Sum as Fraction of Total": pd.Series.sum,
    "Sum as Fraction of Rows": pd.Series.sum,
    "Sum as Fraction of Columns": pd.Series.sum,
    "Count as Fraction of Total": pd.Series.count,
    "Count as Fraction of Rows": pd.Series.count,
    "Count as Fraction of Columns": pd.Series.count,
}


def pivot_table_v2(  # pylint: disable=too-many-branches
    df: pd.DataFrame, form_data: Dict[str, Any]
) -> pd.DataFrame:
    """
    Pivot table v2.
    """
    if form_data.get("granularity_sqla") == "all" and DTTM_ALIAS in df:
        del df[DTTM_ALIAS]

    # TODO (betodealmeida): implement metricsLayout
    metrics = [get_metric_name(m) for m in form_data["metrics"]]
    aggregate_function = form_data.get("aggregateFunction", "Sum")
    groupby = form_data.get("groupbyRows") or []
    columns = form_data.get("groupbyColumns") or []
    if form_data.get("transposePivot"):
        groupby, columns = columns, groupby

    df = df.pivot_table(
        index=groupby,
        columns=columns,
        values=metrics,
        aggfunc=pivot_v2_aggfunc_map[aggregate_function],
        margins=True,
    )

    # The pandas `pivot_table` method either brings both row/column
    # totals, or none at all. We pass `margin=True` to get both, and
    # remove any dimension that was not requests.
    if columns and not form_data.get("rowTotals"):
        df.drop(df.columns[len(df.columns) - 1], axis=1, inplace=True)
    if groupby and not form_data.get("colTotals"):
        df = df[:-1]

    # Compute fractions, if needed. If `colTotals` or `rowTotals` are
    # present we need to adjust for including them in the sum
    if aggregate_function.endswith(" as Fraction of Total"):
        total = df.sum().sum()
        df = df.astype(total.dtypes) / total
        if form_data.get("colTotals"):
            df *= 2
        if form_data.get("rowTotals"):
            df *= 2
    elif aggregate_function.endswith(" as Fraction of Columns"):
        total = df.sum(axis=0)
        df = df.astype(total.dtypes).div(total, axis=1)
        if form_data.get("colTotals"):
            df *= 2
    elif aggregate_function.endswith(" as Fraction of Rows"):
        total = df.sum(axis=1)
        df = df.astype(total.dtypes).div(total, axis=0)
        if form_data.get("rowTotals"):
            df *= 2

    # Display metrics side by side with each column
    if form_data.get("combineMetric"):
        df = df.stack(0).unstack().reindex(level=-1, columns=metrics)

    # flatten column names
    df.columns = [
        " ".join(str(name) for name in column) if isinstance(column, tuple) else column
        for column in df.columns
    ]

    return df


post_processors = {
    "pivot_table": pivot_table,
    "pivot_table_v2": pivot_table_v2,
}


def apply_post_process(
    result: Dict[Any, Any], form_data: Optional[Dict[str, Any]] = None,
) -> Dict[Any, Any]:
    form_data = form_data or {}

    viz_type = form_data.get("viz_type")
    if viz_type not in post_processors:
        return result

    post_processor = post_processors[viz_type]

    for query in result["queries"]:
        df = pd.read_csv(StringIO(query["data"]))
        processed_df = post_processor(df, form_data)

        buf = StringIO()
        processed_df.to_csv(buf)
        buf.seek(0)

        query["data"] = buf.getvalue()
        query["colnames"] = list(processed_df.columns)
        query["coltypes"] = extract_dataframe_dtypes(processed_df)
        query["rowcount"] = len(processed_df.index)

    return result
