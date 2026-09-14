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


def test_select_invalid_exclude():
    # excluding a column that does not exist is a validation error, not a
    # pandas KeyError bubbling up as a 500
    with pytest.raises(InvalidPostProcessingError):
        select(df=timeseries_df, exclude=["abc"])

    # excluding a column already removed by `columns` is also a validation error,
    # and the message names the column so the caller can fix the payload
    with pytest.raises(InvalidPostProcessingError) as excinfo:
        select(df=timeseries_df, columns=["y"], exclude=["label"])
    assert "label" in str(excinfo.value)

    # excluding a column kept by `columns` still works
    post_df = select(df=timeseries_df, columns=["y", "label"], exclude=["label"])
    assert post_df.columns.tolist() == ["y"]


def test_select_exclude_accepts_scalar():
    # `validate_column_args` normalises a scalar through `scalar_to_sequence`, so a
    # bare column name is a supported form and must not be iterated character by
    # character
    post_df = select(df=timeseries_df, exclude="label")
    assert post_df.columns.tolist() == ["y"]

    # a scalar naming a column that does not exist is still a validation error
    with pytest.raises(InvalidPostProcessingError):
        select(df=timeseries_df, exclude="abc")
