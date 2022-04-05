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
from superset.utils.core import PostProcessingBoxplotWhiskerType
from superset.utils.pandas_postprocessing import boxplot
from tests.unit_tests.fixtures.dataframes import names_df


def test_boxplot_tukey():
    df = boxplot(
        df=names_df,
        groupby=["region"],
        whisker_type=PostProcessingBoxplotWhiskerType.TUKEY,
        metrics=["cars"],
    )
    columns = {column for column in df.columns}
    assert columns == {
        "cars__mean",
        "cars__median",
        "cars__q1",
        "cars__q3",
        "cars__max",
        "cars__min",
        "cars__count",
        "cars__outliers",
        "region",
    }
    assert len(df) == 4


def test_boxplot_min_max():
    df = boxplot(
        df=names_df,
        groupby=["region"],
        whisker_type=PostProcessingBoxplotWhiskerType.MINMAX,
        metrics=["cars"],
    )
    columns = {column for column in df.columns}
    assert columns == {
        "cars__mean",
        "cars__median",
        "cars__q1",
        "cars__q3",
        "cars__max",
        "cars__min",
        "cars__count",
        "cars__outliers",
        "region",
    }
    assert len(df) == 4


def test_boxplot_percentile():
    df = boxplot(
        df=names_df,
        groupby=["region"],
        whisker_type=PostProcessingBoxplotWhiskerType.PERCENTILE,
        metrics=["cars"],
        percentiles=[1, 99],
    )
    columns = {column for column in df.columns}
    assert columns == {
        "cars__mean",
        "cars__median",
        "cars__q1",
        "cars__q3",
        "cars__max",
        "cars__min",
        "cars__count",
        "cars__outliers",
        "region",
    }
    assert len(df) == 4


def test_boxplot_percentile_incorrect_params():
    with pytest.raises(InvalidPostProcessingError):
        boxplot(
            df=names_df,
            groupby=["region"],
            whisker_type=PostProcessingBoxplotWhiskerType.PERCENTILE,
            metrics=["cars"],
        )

    with pytest.raises(InvalidPostProcessingError):
        boxplot(
            df=names_df,
            groupby=["region"],
            whisker_type=PostProcessingBoxplotWhiskerType.PERCENTILE,
            metrics=["cars"],
            percentiles=[10],
        )

    with pytest.raises(InvalidPostProcessingError):
        boxplot(
            df=names_df,
            groupby=["region"],
            whisker_type=PostProcessingBoxplotWhiskerType.PERCENTILE,
            metrics=["cars"],
            percentiles=[90, 10],
        )

    with pytest.raises(InvalidPostProcessingError):
        boxplot(
            df=names_df,
            groupby=["region"],
            whisker_type=PostProcessingBoxplotWhiskerType.PERCENTILE,
            metrics=["cars"],
            percentiles=[10, 90, 10],
        )
