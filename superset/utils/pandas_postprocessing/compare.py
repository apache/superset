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
from superset.exceptions import InvalidPostProcessingError
from superset.utils.core import TIME_COMPARISON
from superset.utils.pandas_postprocessing.utils import validate_column_args


@validate_column_args("source_columns", "compare_columns")
def compare(  # pylint: disable=too-many-arguments
    df: DataFrame,
    source_columns: List[str],
    compare_columns: List[str],
    compare_type: PandasPostprocessingCompare,
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
    :raises InvalidPostProcessingError: If the request in incorrect.
    """
    if len(source_columns) != len(compare_columns):
        raise InvalidPostProcessingError(
            _("`compare_columns` must have the same length as `source_columns`.")
        )
    if compare_type not in tuple(PandasPostprocessingCompare):
        raise InvalidPostProcessingError(
            _("`compare_type` must be `difference`, `percentage` or `ratio`")
        )
    if len(source_columns) == 0:
        return df

    for s_col, c_col in zip(source_columns, compare_columns):
        s_df = df.loc[:, [s_col]]
        s_df.rename(columns={s_col: "__intermediate"}, inplace=True)
        c_df = df.loc[:, [c_col]]
        c_df.rename(columns={c_col: "__intermediate"}, inplace=True)
        if compare_type == PandasPostprocessingCompare.DIFF:
            diff_df = s_df - c_df
        elif compare_type == PandasPostprocessingCompare.PCT:
            diff_df = ((s_df - c_df) / c_df).astype(float).round(precision)
        else:
            # compare_type == "ratio"
            diff_df = (s_df / c_df).astype(float).round(precision)

        diff_df.rename(
            columns={
                "__intermediate": TIME_COMPARISON.join([compare_type, s_col, c_col])
            },
            inplace=True,
        )
        df = pd.concat([df, diff_df], axis=1)

    if drop_original_columns:
        df = df.drop(source_columns + compare_columns, axis=1)
    return df
