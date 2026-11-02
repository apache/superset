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
from typing import Optional

from flask_babel import gettext as _
from pandas import DataFrame

from superset.exceptions import InvalidPostProcessingError
from superset.utils.pandas_postprocessing.utils import (
    scalar_to_sequence,
    validate_column_args,
)


@validate_column_args("columns", "exclude", "rename")
def select(
    df: DataFrame,
    columns: Optional[list[str]] = None,
    exclude: Optional[list[str]] = None,
    rename: Optional[dict[str, str]] = None,
) -> DataFrame:
    """
    Only select a subset of columns in the original dataset. Can be useful for
    removing unnecessary intermediate results, renaming and reordering columns.

    :param df: DataFrame on which the rolling period will be based.
    :param columns: Columns which to select from the DataFrame, in the desired order.
                    If left undefined, all columns will be selected. If columns are
                    renamed, the original column name should be referenced here.
    :param exclude: columns to exclude from selection. Applied after `columns` and
                    before `rename`, so the original column name should be referenced
                    here, and the column must survive the `columns` selection.
    :param rename: columns which to rename, mapping source column to target column.
                   For instance, `{'y': 'y2'}` will rename the column `y` to
                   `y2`.
    :return: Subset of columns in original DataFrame
    :raises InvalidPostProcessingError: If the request in incorrect
    """
    df_select = df.copy(deep=False)
    if columns:
        df_select = df_select[columns]
    if exclude:
        # A bare column name is accepted as well as a sequence: `validate_column_args`
        # normalises through `scalar_to_sequence` to validate, then hands the original
        # value on. Normalise here too, so a string is not iterated character by
        # character.
        exclude = list(scalar_to_sequence(exclude))
        # `exclude` is validated against the incoming DataFrame by the decorator, but
        # a preceding `columns` selection may already have removed the column. Reject
        # that as a validation error instead of letting pandas raise a bare KeyError.
        if missing := [column for column in exclude if column not in df_select.columns]:
            raise InvalidPostProcessingError(
                _(
                    "Referenced columns not available in DataFrame: %(columns)s",
                    columns=", ".join(missing),
                )
            )
        df_select = df_select.drop(exclude, axis=1)
    if rename is not None:
        df_select = df_select.rename(columns=rename)
    return df_select
