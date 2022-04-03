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

from superset.exceptions import InvalidPostProcessingError
from superset.utils.pandas_postprocessing.select import select
from tests.unit_tests.fixtures.dataframes import timeseries_df


def test_select():
    # reorder columns
    post_df = select(df=timeseries_df, columns=["y", "label"])
    assert post_df.columns.tolist() == ["y", "label"]

    # one column
    post_df = select(df=timeseries_df, columns=["label"])
    assert post_df.columns.tolist() == ["label"]

    # rename and select one column
    post_df = select(df=timeseries_df, columns=["y"], rename={"y": "y1"})
    assert post_df.columns.tolist() == ["y1"]

    # rename one and leave one unchanged
    post_df = select(df=timeseries_df, rename={"y": "y1"})
    assert post_df.columns.tolist() == ["label", "y1"]

    # drop one column
    post_df = select(df=timeseries_df, exclude=["label"])
    assert post_df.columns.tolist() == ["y"]

    # rename and drop one column
    post_df = select(df=timeseries_df, rename={"y": "y1"}, exclude=["label"])
    assert post_df.columns.tolist() == ["y1"]

    # invalid columns
    with pytest.raises(InvalidPostProcessingError):
        select(df=timeseries_df, columns=["abc"], rename={"abc": "qwerty"})

    # select renamed column by new name
    with pytest.raises(InvalidPostProcessingError):
        select(df=timeseries_df, columns=["label_new"], rename={"label": "label_new"})
