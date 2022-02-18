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

from datetime import datetime

import pytest
from numpy import nan
from numpy.testing import assert_array_equal
from pandas import DataFrame

from superset.exceptions import QueryObjectValidationError
from superset.utils.core import DTTM_ALIAS, PostProcessingContributionOrientation
from superset.utils.pandas_postprocessing import contribution


def test_contribution():
    df = DataFrame(
        {
            DTTM_ALIAS: [
                datetime(2020, 7, 16, 14, 49),
                datetime(2020, 7, 16, 14, 50),
                datetime(2020, 7, 16, 14, 51),
            ],
            "a": [1, 3, nan],
            "b": [1, 9, nan],
            "c": [nan, nan, nan],
        }
    )
    with pytest.raises(QueryObjectValidationError, match="not numeric"):
        contribution(df, columns=[DTTM_ALIAS])

    with pytest.raises(QueryObjectValidationError, match="same length"):
        contribution(df, columns=["a"], rename_columns=["aa", "bb"])

    # cell contribution across row
    processed_df = contribution(
        df, orientation=PostProcessingContributionOrientation.ROW,
    )
    assert processed_df.columns.tolist() == [DTTM_ALIAS, "a", "b", "c"]
    assert_array_equal(processed_df["a"].tolist(), [0.5, 0.25, nan])
    assert_array_equal(processed_df["b"].tolist(), [0.5, 0.75, nan])
    assert_array_equal(processed_df["c"].tolist(), [0, 0, nan])

    # cell contribution across column without temporal column
    df.pop(DTTM_ALIAS)
    processed_df = contribution(
        df, orientation=PostProcessingContributionOrientation.COLUMN
    )
    assert processed_df.columns.tolist() == ["a", "b", "c"]
    assert_array_equal(processed_df["a"].tolist(), [0.25, 0.75, 0])
    assert_array_equal(processed_df["b"].tolist(), [0.1, 0.9, 0])
    assert_array_equal(processed_df["c"].tolist(), [nan, nan, nan])

    # contribution only on selected columns
    processed_df = contribution(
        df,
        orientation=PostProcessingContributionOrientation.COLUMN,
        columns=["a"],
        rename_columns=["pct_a"],
    )
    assert processed_df.columns.tolist() == ["a", "b", "c", "pct_a"]
    assert_array_equal(processed_df["a"].tolist(), [1, 3, nan])
    assert_array_equal(processed_df["b"].tolist(), [1, 9, nan])
    assert_array_equal(processed_df["c"].tolist(), [nan, nan, nan])
    assert processed_df["pct_a"].tolist() == [0.25, 0.75, 0]
