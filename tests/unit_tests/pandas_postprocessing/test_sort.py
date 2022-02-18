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

from superset.exceptions import QueryObjectValidationError
from superset.utils.pandas_postprocessing import sort
from tests.unit_tests.fixtures.dataframes import categories_df
from tests.unit_tests.pandas_postprocessing.utils import series_to_list


def test_sort():
    df = sort(df=categories_df, columns={"category": True, "asc_idx": False})
    assert series_to_list(df["asc_idx"])[1] == 96

    with pytest.raises(QueryObjectValidationError):
        sort(df=df, columns={"abc": True})
