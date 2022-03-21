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

from superset.utils.pandas_postprocessing import compare
from tests.unit_tests.fixtures.dataframes import timeseries_df2
from tests.unit_tests.pandas_postprocessing.utils import series_to_list


def test_compare():
    # `difference` comparison
    post_df = compare(
        df=timeseries_df2,
        source_columns=["y"],
        compare_columns=["z"],
        compare_type="difference",
    )
    assert post_df.columns.tolist() == ["label", "y", "z", "difference__y__z"]
    assert series_to_list(post_df["difference__y__z"]) == [0.0, -2.0, -8.0, -6.0]

    # drop original columns
    post_df = compare(
        df=timeseries_df2,
        source_columns=["y"],
        compare_columns=["z"],
        compare_type="difference",
        drop_original_columns=True,
    )
    assert post_df.columns.tolist() == ["label", "difference__y__z"]

    # `percentage` comparison
    post_df = compare(
        df=timeseries_df2,
        source_columns=["y"],
        compare_columns=["z"],
        compare_type="percentage",
    )
    assert post_df.columns.tolist() == ["label", "y", "z", "percentage__y__z"]
    assert series_to_list(post_df["percentage__y__z"]) == [0.0, -0.5, -0.8, -0.75]

    # `ratio` comparison
    post_df = compare(
        df=timeseries_df2,
        source_columns=["y"],
        compare_columns=["z"],
        compare_type="ratio",
    )
    assert post_df.columns.tolist() == ["label", "y", "z", "ratio__y__z"]
    assert series_to_list(post_df["ratio__y__z"]) == [1.0, 0.5, 0.2, 0.25]
