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
from decimal import Decimal
from typing import List, Optional

from flask_babel import gettext as _
from pandas import DataFrame

from superset.exceptions import InvalidPostProcessingError
from superset.utils.core import PostProcessingContributionOrientation
from superset.utils.pandas_postprocessing.utils import validate_column_args


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
    columns = columns or numeric_df.columns
    rename_columns = rename_columns or columns
    if len(rename_columns) != len(columns):
        raise InvalidPostProcessingError(
            _("`rename_columns` must have the same length as `columns`.")
        )
    # limit to selected columns
    numeric_df = numeric_df[columns]
    axis = 0 if orientation == PostProcessingContributionOrientation.COLUMN else 1
    numeric_df = numeric_df / numeric_df.values.sum(axis=axis, keepdims=True)
    contribution_df[rename_columns] = numeric_df
    return contribution_df
