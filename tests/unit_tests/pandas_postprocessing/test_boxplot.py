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
import warnings

import pandas as pd
import pytest

from superset.exceptions import InvalidPostProcessingError
from superset.utils.core import PostProcessingBoxplotWhiskerType
from superset.utils.pandas_postprocessing import boxplot
from tests.unit_tests.fixtures.dataframes import names_df
from tests.unit_tests.pandas_postprocessing.utils import series_to_list


def test_boxplot_tukey():
    df = boxplot(
        df=names_df,
        groupby=["region"],
        whisker_type=PostProcessingBoxplotWhiskerType.TUKEY,
        metrics=["cars"],
    )
    columns = {column for column in df.columns}  # noqa: C416
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
    assert len(df) == 5


def test_boxplot_mean_median_no_future_warning():
    """mean/median must be passed as strings (not np.mean/np.median) to
    GroupBy.agg, else pandas raises a FutureWarning. Also verify the values
    match a plain pandas groupby, since the string and callable forms could
    silently diverge on a future pandas version."""
    expected = names_df.groupby("region", dropna=False)["cars"].agg(["mean", "median"])

    with warnings.catch_warnings():
        warnings.simplefilter("error", FutureWarning)
        df = boxplot(
            df=names_df,
            groupby=["region"],
            whisker_type=PostProcessingBoxplotWhiskerType.TUKEY,
            metrics=["cars"],
        )

    df = df.set_index("region")
    assert series_to_list(df["cars__mean"]) == series_to_list(expected["mean"])
    assert series_to_list(df["cars__median"]) == series_to_list(expected["median"])


def test_boxplot_minmax_no_future_warning():
    """Under MINMAX, whisker_high/whisker_low are plain np.max/np.min, which
    must be passed as strings (not the callables) to GroupBy.agg, else pandas
    raises a FutureWarning. Also verify the values match a plain pandas
    groupby, since the string and callable forms could silently diverge on a
    future pandas version."""
    expected = names_df.groupby("region", dropna=False)["cars"].agg(["max", "min"])

    with warnings.catch_warnings():
        warnings.simplefilter("error", FutureWarning)
        df = boxplot(
            df=names_df,
            groupby=["region"],
            whisker_type=PostProcessingBoxplotWhiskerType.MINMAX,
            metrics=["cars"],
        )

    df = df.set_index("region")
    assert series_to_list(df["cars__max"]) == series_to_list(expected["max"])
    assert series_to_list(df["cars__min"]) == series_to_list(expected["min"])


def test_boxplot_min_max():
    df = boxplot(
        df=names_df,
        groupby=["region"],
        whisker_type=PostProcessingBoxplotWhiskerType.MINMAX,
        metrics=["cars"],
    )
    columns = {column for column in df.columns}  # noqa: C416
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
    assert len(df) == 5


def test_boxplot_percentile():
    df = boxplot(
        df=names_df,
        groupby=["region"],
        whisker_type=PostProcessingBoxplotWhiskerType.PERCENTILE,
        metrics=["cars"],
        percentiles=[1, 99],
    )
    columns = {column for column in df.columns}  # noqa: C416
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
    assert len(df) == 5


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


def test_boxplot_type_coercion():
    df = names_df
    df["cars"] = df["cars"].astype(str)
    df = boxplot(
        df=df,
        groupby=["region"],
        whisker_type=PostProcessingBoxplotWhiskerType.TUKEY,
        metrics=["cars"],
    )

    columns = {column for column in df.columns}  # noqa: C416
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
    assert len(df) == 5


@pytest.mark.parametrize(
    "whisker_type,minimum,maximum,outliers",
    [
        (PostProcessingBoxplotWhiskerType.TUKEY, 1, 4, [100.0]),
        (PostProcessingBoxplotWhiskerType.MINMAX, 1, 100, []),
        (PostProcessingBoxplotWhiskerType.PERCENTILE, 2, 4, [100.0, 1.0]),
    ],
)
@pytest.mark.parametrize("all_null", [False, True])
def test_boxplot_preserves_null_group_statistics(
    whisker_type: PostProcessingBoxplotWhiskerType,
    minimum: float,
    maximum: float,
    outliers: list[float],
    all_null: bool,
) -> None:
    """NULL categories retain statistics and the existing missing-value rules."""
    df = pd.DataFrame({"category": [None] * 6, "value": [1, 2, 3, 4, 100, None]})
    if not all_null:
        df = pd.concat(
            [df, pd.DataFrame({"category": ["alpha"] * 3, "value": [10, 20, 30]})],
            ignore_index=True,
        )

    result = boxplot(
        df,
        groupby=["category"],
        metrics=["value"],
        whisker_type=whisker_type,
        percentiles=[25, 75],
    )

    assert len(result) == (1 if all_null else 2)
    null_group = result[result["category"].isna()].iloc[0]
    assert null_group.drop(labels="category").to_dict() == {
        "value__mean": 22.0,
        "value__median": 3.0,
        "value__min": minimum,
        "value__max": maximum,
        "value__q1": 2.0,
        "value__q3": 4.0,
        # Boxplot count includes missing observations, as for non-NULL groups.
        "value__count": 6,
        "value__outliers": outliers,
    }
    if not all_null:
        assert result.loc[result["category"] == "alpha", "value__mean"].item() == 20


def test_boxplot_preserves_null_keys_in_multiple_grouping_columns() -> None:
    """NULL keys in either dimension remain distinct boxplot groups."""
    result = boxplot(
        pd.DataFrame(
            {
                "category": ["alpha", "alpha", None, None],
                "region": ["east", None, "east", None],
                "value": [1, 2, 3, 4],
            }
        ),
        groupby=["category", "region"],
        metrics=["value"],
        whisker_type=PostProcessingBoxplotWhiskerType.TUKEY,
    )

    assert len(result) == 4
    assert result["category"].isna().tolist() == [False, False, True, True]
    assert result["region"].isna().tolist() == [False, True, False, True]
    for statistic in ["mean", "median", "min", "max", "q1", "q3"]:
        assert result[f"value__{statistic}"].tolist() == [1.0, 2.0, 3.0, 4.0]
    assert result["value__count"].tolist() == [1, 1, 1, 1]
    assert result["value__outliers"].tolist() == [[], [], [], []]
