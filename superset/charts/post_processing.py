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
post-processing of the data in JavaScript. When sending the data
to users in reports we want to show the same data they would see
on Explore.

In order to do that, we reproduce the post-processing in Python
for these chart types.
"""

from io import StringIO
from typing import Any, Optional, TYPE_CHECKING, Union

import pandas as pd
from flask_babel import gettext as __

from superset.common.chart_data import ChartDataResultFormat
from superset.utils.core import (
    extract_dataframe_dtypes,
    get_column_names,
    get_metric_names,
)

if TYPE_CHECKING:
    from superset.connectors.base.models import BaseDatasource
    from superset.models.sql_lab import Query


def get_column_key(label: tuple[str, ...], metrics: list[str]) -> tuple[Any, ...]:
    """
    Sort columns when combining metrics.

    MultiIndex labels have the metric name as the last element in the
    tuple. We want to sort these according to the list of passed metrics.
    """
    parts: list[Any] = list(label)
    metric = parts[-1]
    parts[-1] = metrics.index(metric)
    return tuple(parts)


def pivot_df(  # pylint: disable=too-many-locals, too-many-arguments, too-many-statements, too-many-branches
    df: pd.DataFrame,
    rows: list[str],
    columns: list[str],
    metrics: list[str],
    aggfunc: str = "Sum",
    transpose_pivot: bool = False,
    combine_metrics: bool = False,
    show_rows_total: bool = False,
    show_columns_total: bool = False,
    apply_metrics_on_rows: bool = False,
) -> pd.DataFrame:
    metric_name = __("Total (%(aggfunc)s)", aggfunc=aggfunc)

    if transpose_pivot:
        rows, columns = columns, rows

    # to apply the metrics on the rows we pivot the dataframe, apply the
    # metrics to the columns, and pivot the dataframe back before
    # returning it
    if apply_metrics_on_rows:
        rows, columns = columns, rows
        axis = {"columns": 0, "rows": 1}
    else:
        axis = {"columns": 1, "rows": 0}

    # pivot data; we'll compute totals and subtotals later
    if rows or columns:
        # pivoting with null values will create an empty df
        df = df.fillna("NULL")
        df = df.pivot_table(
            index=rows,
            columns=columns,
            values=metrics,
            aggfunc=pivot_v2_aggfunc_map[aggfunc],
            margins=False,
        )
    else:
        # if there's no rows nor columns we have a single value; update
        # the index with the metric name so it shows up in the table
        df.index = pd.Index([*df.index[:-1], metric_name], name="metric")

    # if no rows were passed the metrics will be in the rows, so we
    # need to move them back to columns
    if columns and not rows:
        df = df.stack()
        if not isinstance(df, pd.DataFrame):
            df = df.to_frame()
        df = df.T
        df = df[metrics]
        df.index = pd.Index([*df.index[:-1], metric_name], name="metric")

    # combining metrics changes the column hierarchy, moving the metric
    # from the top to the bottom, eg:
    #
    # ('SUM(col)', 'age', 'name') => ('age', 'name', 'SUM(col)')
    if combine_metrics and isinstance(df.columns, pd.MultiIndex):
        # move metrics to the lowest level
        new_order = [*range(1, df.columns.nlevels), 0]
        df = df.reorder_levels(new_order, axis=1)

        # sort columns, combining metrics for each group
        decorated_columns = [(col, i) for i, col in enumerate(df.columns)]
        grouped_columns = sorted(
            decorated_columns, key=lambda t: get_column_key(t[0], metrics)
        )
        indexes = [i for col, i in grouped_columns]
        df = df[df.columns[indexes]]
    elif rows:
        # if metrics were not combined we sort the dataframe by the list
        # of metrics defined by the user
        df = df[metrics]

    # compute fractions, if needed
    if aggfunc.endswith(" as Fraction of Total"):
        total = df.sum().sum()
        df = df.astype(total.dtypes) / total
    elif aggfunc.endswith(" as Fraction of Columns"):
        total = df.sum(axis=axis["rows"])
        df = df.astype(total.dtypes).div(total, axis=axis["columns"])
    elif aggfunc.endswith(" as Fraction of Rows"):
        total = df.sum(axis=axis["columns"])
        df = df.astype(total.dtypes).div(total, axis=axis["rows"])

    # convert to a MultiIndex to simplify logic
    if not isinstance(df.index, pd.MultiIndex):
        df.index = pd.MultiIndex.from_tuples([(str(i),) for i in df.index])
    if not isinstance(df.columns, pd.MultiIndex):
        df.columns = pd.MultiIndex.from_tuples([(str(i),) for i in df.columns])

    if show_rows_total:
        # add subtotal for each group and overall total; we start from the
        # overall group, and iterate deeper into subgroups
        groups = df.columns
        for level in range(df.columns.nlevels):
            subgroups = {group[:level] for group in groups}
            for subgroup in subgroups:
                slice_ = df.columns.get_loc(subgroup)
                subtotal = pivot_v2_aggfunc_map[aggfunc](df.iloc[:, slice_], axis=1)
                depth = df.columns.nlevels - len(subgroup) - 1
                total = metric_name if level == 0 else __("Subtotal")
                subtotal_name = tuple([*subgroup, total, *([""] * depth)])
                # insert column after subgroup
                df.insert(int(slice_.stop), subtotal_name, subtotal)

    if rows and show_columns_total:
        # add subtotal for each group and overall total; we start from the
        # overall group, and iterate deeper into subgroups
        groups = df.index
        for level in range(df.index.nlevels):
            subgroups = {group[:level] for group in groups}
            for subgroup in subgroups:
                slice_ = df.index.get_loc(subgroup)
                subtotal = pivot_v2_aggfunc_map[aggfunc](
                    df.iloc[slice_, :].apply(pd.to_numeric), axis=0
                )
                depth = df.index.nlevels - len(subgroup) - 1
                total = metric_name if level == 0 else __("Subtotal")
                subtotal.name = tuple([*subgroup, total, *([""] * depth)])
                # insert row after subgroup
                df = pd.concat(
                    [df[: slice_.stop], subtotal.to_frame().T, df[slice_.stop :]]
                )

    # if we want to apply the metrics on the rows we need to pivot the
    # dataframe back
    if apply_metrics_on_rows:
        df = df.T

    return df


def list_unique_values(series: pd.Series) -> str:
    """
    List unique values in a series.
    """
    return ", ".join({str(v) for v in pd.Series.unique(series)})


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


def pivot_table_v2(
    df: pd.DataFrame,
    form_data: dict[str, Any],
    datasource: Optional[Union["BaseDatasource", "Query"]] = None,
) -> pd.DataFrame:
    """
    Pivot table v2.
    """
    verbose_map = datasource.data["verbose_map"] if datasource else None

    return pivot_df(
        df,
        rows=get_column_names(form_data.get("groupbyRows"), verbose_map),
        columns=get_column_names(form_data.get("groupbyColumns"), verbose_map),
        metrics=get_metric_names(form_data["metrics"], verbose_map),
        aggfunc=form_data.get("aggregateFunction", "Sum"),
        transpose_pivot=bool(form_data.get("transposePivot")),
        combine_metrics=bool(form_data.get("combineMetric")),
        show_rows_total=bool(form_data.get("rowTotals")),
        show_columns_total=bool(form_data.get("colTotals")),
        apply_metrics_on_rows=form_data.get("metricsLayout") == "ROWS",
    )


def table(
    df: pd.DataFrame,
    form_data: dict[str, Any],
    datasource: Optional[  # pylint: disable=unused-argument
        Union["BaseDatasource", "Query"]
    ] = None,
) -> pd.DataFrame:
    """
    Table.
    """
    # apply `d3NumberFormat` to columns, if present
    column_config = form_data.get("column_config", {})
    for column, config in column_config.items():
        if "d3NumberFormat" in config:
            format_ = "{:" + config["d3NumberFormat"] + "}"
            try:
                df[column] = df[column].apply(format_.format)
            except Exception:  # pylint: disable=broad-except
                # if we can't format the column for any reason, send as is
                pass

    return df


post_processors = {
    "pivot_table_v2": pivot_table_v2,
    "table": table,
}


def apply_post_process(
    result: dict[Any, Any],
    form_data: Optional[dict[str, Any]] = None,
    datasource: Optional[Union["BaseDatasource", "Query"]] = None,
) -> dict[Any, Any]:
    form_data = form_data or {}

    viz_type = form_data.get("viz_type")
    if viz_type not in post_processors:
        return result

    post_processor = post_processors[viz_type]

    for query in result["queries"]:
        if query["result_format"] not in (rf.value for rf in ChartDataResultFormat):
            raise Exception(f"Result format {query['result_format']} not supported")

        data = query["data"]

        if isinstance(data, str):
            data = data.strip()

        if not data:
            # do not try to process empty data
            continue

        if query["result_format"] == ChartDataResultFormat.JSON:
            df = pd.DataFrame.from_dict(data)
        elif query["result_format"] == ChartDataResultFormat.CSV:
            df = pd.read_csv(StringIO(data))

        # convert all columns to verbose (label) name
        if datasource:
            df.rename(columns=datasource.data["verbose_map"], inplace=True)

        processed_df = post_processor(df, form_data, datasource)

        query["colnames"] = list(processed_df.columns)
        query["indexnames"] = list(processed_df.index)
        query["coltypes"] = extract_dataframe_dtypes(processed_df, datasource)
        query["rowcount"] = len(processed_df.index)

        # Flatten hierarchical columns/index since they are represented as
        # `Tuple[str]`. Otherwise encoding to JSON later will fail because
        # maps cannot have tuples as their keys in JSON.
        processed_df.columns = [
            " ".join(str(name) for name in column).strip()
            if isinstance(column, tuple)
            else column
            for column in processed_df.columns
        ]
        processed_df.index = [
            " ".join(str(name) for name in index).strip()
            if isinstance(index, tuple)
            else index
            for index in processed_df.index
        ]

        if query["result_format"] == ChartDataResultFormat.JSON:
            query["data"] = processed_df.to_dict()
        elif query["result_format"] == ChartDataResultFormat.CSV:
            buf = StringIO()
            processed_df.to_csv(buf)
            buf.seek(0)
            query["data"] = buf.getvalue()

    return result
