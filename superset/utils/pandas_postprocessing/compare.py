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
from typing import List, Optional

import pandas as pd
from flask_babel import gettext as _
from pandas import DataFrame

from superset.constants import PandasPostprocessingCompare
from superset.exceptions import QueryObjectValidationError
from superset.utils.core import TIME_COMPARISION
from superset.utils.pandas_postprocessing.utils import validate_column_args


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
