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
import pytest
from dateutil.parser import parse

from superset.exceptions import InvalidPostProcessingError
from superset.utils.pandas_postprocessing import sort
from tests.unit_tests.fixtures.dataframes import categories_df, timeseries_df
from tests.unit_tests.pandas_postprocessing.utils import series_to_list


def test_sort():
    df = sort(df=categories_df, by=["category", "asc_idx"], ascending=[True, False])
    assert series_to_list(df["asc_idx"])[1] == 96

    df = sort(df=categories_df.set_index("name"), is_sort_index=True)
    assert df.index[0] == "person0"

    df = sort(df=categories_df.set_index("name"), is_sort_index=True, ascending=False)
    assert df.index[0] == "person99"

    df = sort(df=categories_df.set_index("name"), by="asc_idx")
    assert df["asc_idx"][0] == 0

    df = sort(df=categories_df.set_index("name"), by="asc_idx", ascending=False)
    assert df["asc_idx"][0] == 100

    df = sort(df=timeseries_df, is_sort_index=True)
    assert df.index[0] == parse("2019-01-01")

    df = sort(df=timeseries_df, is_sort_index=True, ascending=False)
    assert df.index[0] == parse("2019-01-07")

    df = sort(df=timeseries_df)
    assert df.equals(timeseries_df)

    with pytest.raises(InvalidPostProcessingError):
        sort(df=df, by="abc", ascending=False)
        sort(df=df, by=["abc", "def"])
