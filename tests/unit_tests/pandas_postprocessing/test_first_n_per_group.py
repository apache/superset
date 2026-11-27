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
from typing import Any

import pytest
from pandas import DataFrame

from superset.charts.schemas import ChartDataPostProcessingOperationSchema
from superset.exceptions import InvalidPostProcessingError
from superset.utils.pandas_postprocessing import first_n_per_group

children_df = DataFrame(
    {
        "parent": ["A", "A", "A", "B"],
        "child": ["a3", "a1", "a2", "b1"],
        "step": [30, 10, 20, 1],
    }
)


def test_first_n_per_group_keeps_first_n_in_input_order() -> None:
    post_df = first_n_per_group(df=children_df, groupby=["parent"], n=2)
    assert post_df.columns.tolist() == ["parent", "child", "step"]
    assert post_df.to_dict(orient="records") == [
        {"parent": "A", "child": "a3", "step": 30},
        {"parent": "A", "child": "a1", "step": 10},
        {"parent": "B", "child": "b1", "step": 1},
    ]
    assert post_df.index.tolist() == [0, 1, 3]
    assert "C" not in post_df["parent"].tolist()


def test_first_n_per_group_n_larger_than_groups() -> None:
    post_df = first_n_per_group(df=children_df, groupby=["parent"], n=100)
    assert post_df.equals(children_df)


def test_first_n_per_group_multiple_columns() -> None:
    df = DataFrame({"p1": [1, 1, 1, 2], "p2": ["x", "x", "y", "x"], "c": [1, 2, 3, 4]})
    post_df = first_n_per_group(df=df, groupby=["p1", "p2"], n=1)
    assert post_df["c"].tolist() == [1, 3, 4]


def test_first_n_per_group_keeps_null_group() -> None:
    df = DataFrame(
        {
            "parent": ["A", None, None, None, "A"],
            "child": [1, 2, 3, 4, 5],
        }
    )
    post_df = first_n_per_group(df=df, groupby=["parent"], n=2)
    assert post_df["child"].tolist() == [1, 2, 3, 5]


def test_first_n_per_group_empty_df() -> None:
    df = children_df.iloc[0:0]
    post_df = first_n_per_group(df=df, groupby=["parent"], n=2)
    assert post_df.empty
    assert post_df.columns.tolist() == ["parent", "child", "step"]


@pytest.mark.parametrize(
    "options",
    [
        {"groupby": [], "n": 2},
        {"groupby": ["missing"], "n": 2},
        {"groupby": ["parent"], "n": 0},
        {"groupby": ["parent"], "n": -1},
        {"groupby": ["parent"], "n": 1.5},
        {"groupby": ["parent"], "n": True},
    ],
)
def test_first_n_per_group_bad_options(options: dict[str, Any]) -> None:
    with pytest.raises(InvalidPostProcessingError):
        first_n_per_group(df=children_df, **options)


def test_first_n_per_group_passes_post_processing_schema() -> None:
    rule = {
        "operation": "first_n_per_group",
        "options": {"groupby": ["parent"], "n": 2},
    }
    assert ChartDataPostProcessingOperationSchema().load(rule) == rule
