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
from typing import Any, Dict, List, Optional

from flask_babel import gettext as _
from pandas import DataFrame

from superset.constants import NULL_STRING, PandasAxis
from superset.exceptions import InvalidPostProcessingError
from superset.utils.pandas_postprocessing.utils import (
    _flatten_column_after_pivot,
    _get_aggregate_funcs,
    validate_column_args,
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
    :raises InvalidPostProcessingError: If the request in incorrect
    """
    if not index:
        raise InvalidPostProcessingError(
            _("Pivot operation requires at least one index")
        )
    if not aggregates:
        raise InvalidPostProcessingError(
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
