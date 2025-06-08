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
from superset.utils.pandas_postprocessing import aggregate
from tests.unit_tests.fixtures.dataframes import categories_df
from tests.unit_tests.pandas_postprocessing.utils import series_to_list


def test_aggregate():
    aggregates = {
        "asc sum": {"column": "asc_idx", "operator": "sum"},
        "asc q2": {
            "column": "asc_idx",
            "operator": "percentile",
            "options": {"q": 75},
        },
        "desc q1": {
            "column": "desc_idx",
            "operator": "percentile",
            "options": {"q": 25},
        },
    }
    df = aggregate(df=categories_df, groupby=["constant"], aggregates=aggregates)
    assert df.columns.tolist() == ["constant", "asc sum", "asc q2", "desc q1"]
    assert series_to_list(df["asc sum"])[0] == 5050
    assert series_to_list(df["asc q2"])[0] == 75
    assert series_to_list(df["desc q1"])[0] == 25
