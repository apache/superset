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
from __future__ import annotations

from decimal import Decimal
from typing import Any

from flask_babel import gettext as _
from pandas import DataFrame, MultiIndex

from superset.exceptions import InvalidPostProcessingError
from superset.utils.core import PostProcessingContributionOrientation
from superset.utils.pandas_postprocessing.utils import validate_column_args


@validate_column_args("columns")
def contribution(
    df: DataFrame,
    orientation: (
        PostProcessingContributionOrientation | None
    ) = PostProcessingContributionOrientation.COLUMN,
    columns: list[str] | None = None,
    time_shifts: list[str] | None = None,
    rename_columns: list[str] | None = None,
) -> DataFrame:
    """
    Calculate cell contribution to row/column total for numeric columns.
    Non-numeric columns will be kept untouched.

    If `columns` are specified, only calculate contributions on selected columns.

    Contribution for time shift columns will be calculated separately.

    :param df: DataFrame containing all-numeric data (temporal column ignored)
    :param columns: Columns to calculate values from.
    :param time_shifts: The applied time shifts.
    :param rename_columns: The new labels for the calculated contribution columns.
                           The original columns will not be removed.
    :param orientation: calculate by dividing cell with row/column total
    :return: DataFrame with contributions.
    """
    contribution_df = df.copy()
    numeric_df = contribution_df.select_dtypes(include=["number", Decimal])
    numeric_df.fillna(0, inplace=True)
    # verify column selections
    if columns:
        numeric_columns = numeric_df.columns.tolist()
        for col in columns:
            if col not in numeric_columns:
                raise InvalidPostProcessingError(
                    _(
                        'Column "%(column)s" is not numeric or does not '
                        "exists in the query results.",
                        column=col,
                    )
                )
    actual_columns = columns or numeric_df.columns

    rename_columns = rename_columns or actual_columns
    if len(rename_columns) != len(actual_columns):
        raise InvalidPostProcessingError(
            _(
                "`rename_columns` must have the same length as `columns` + `time_shift_columns`."
            )
        )
    # limit to selected columns
    numeric_df_view = numeric_df[actual_columns]

    if orientation == PostProcessingContributionOrientation.COLUMN:
        numeric_df_view = numeric_df_view / numeric_df_view.values.sum(
            axis=0, keepdims=True
        )
        contribution_df[rename_columns] = numeric_df_view
        return contribution_df

    result = get_column_groups(numeric_df_view, time_shifts, rename_columns)
    calculate_row_contribution(
        contribution_df, result["non_time_shift"][0], result["non_time_shift"][1]
    )
    for time_shift in result["time_shifts"].items():
        calculate_row_contribution(contribution_df, time_shift[1][0], time_shift[1][1])
    return contribution_df


def get_column_groups(
    df: DataFrame, time_shifts: list[str] | None, rename_columns: list[str]
) -> dict[str, Any]:
    """
    Group columns based on whether they have a time shift.

    :param df: DataFrame to group columns from
    :param time_shifts: List of time shifts to group by
    :param rename_columns: List of new column names
    :return: Dictionary with two keys: 'non_time_shift' and 'time_shifts'. 'non_time_shift'
    maps to a tuple of original and renamed columns without a time shift. 'time_shifts' maps
    to a dictionary where each key is a time shift and each value is a tuple of original and
    renamed columns with that time shift.
    """
    result: dict[str, Any] = {
        "non_time_shift": ([], []),  # take the form of ([A, B, C], [X, Y, Z])
        "time_shifts": {},  # take the form of {A: ([X], [Y]), B: ([Z], [W])}
    }
    for i, col in enumerate(df.columns):
        col_0 = col[0] if isinstance(df.columns, MultiIndex) else col
        time_shift = None
        if time_shifts and isinstance(col_0, str):
            for ts in time_shifts:
                if col_0.endswith(ts):
                    time_shift = ts
                    break
        if time_shift is not None:
            if time_shift not in result["time_shifts"]:
                result["time_shifts"][time_shift] = ([], [])
            result["time_shifts"][time_shift][0].append(col)
            result["time_shifts"][time_shift][1].append(rename_columns[i])
        else:
            result["non_time_shift"][0].append(col)
            result["non_time_shift"][1].append(rename_columns[i])
    return result


def calculate_row_contribution(
    df: DataFrame, columns: list[str], rename_columns: list[str]
) -> None:
    """
    Calculate the contribution of each column to the row total and update the DataFrame.

    This function calculates the contribution of each selected column to the total of the row,
    and updates the DataFrame with these contribution percentages in place of the original values.

    :param df: The DataFrame to calculate contributions for.
    :param columns: A list of column names to calculate contributions for.
    :param rename_columns: A list of new column names for the contribution columns.
    """
    # calculate the row sum considering only the selected columns
    row_sum_except_selected = df.loc[:, columns].sum(axis=1)

    # update the dataframe cells with the row contribution percentage
    df[rename_columns] = df.loc[:, columns].div(row_sum_except_selected, axis=0)
