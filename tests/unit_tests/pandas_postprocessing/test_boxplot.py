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
from importlib import import_module

import numpy as np
import pandas as pd
import pytest
from pandas import DataFrame
from pandas.testing import assert_frame_equal

from superset.exceptions import InvalidPostProcessingError
from superset.utils import json
from superset.utils.core import PostProcessingBoxplotWhiskerType
from superset.utils.pandas_postprocessing import boxplot
from superset.utils.pandas_postprocessing.density import estimate_density
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
    assert len(df) == 4


def test_boxplot_mean_median_no_future_warning():
    """mean/median must be passed as strings (not np.mean/np.median) to
    GroupBy.agg, else pandas raises a FutureWarning. Also verify the values
    match a plain pandas groupby, since the string and callable forms could
    silently diverge on a future pandas version."""
    expected = names_df.groupby("region")["cars"].agg(["mean", "median"])

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
    expected = names_df.groupby("region")["cars"].agg(["max", "min"])

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
    assert len(df) == 4


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
    assert len(df) == 4


@pytest.mark.parametrize("whisker_type", list(PostProcessingBoxplotWhiskerType))
def test_boxplot_count_excludes_null_metric_values(
    whisker_type: PostProcessingBoxplotWhiskerType,
) -> None:
    """`__count` is the number of observations, so rows whose metric is NULL
    are left out of it, and a group with no values at all counts zero."""
    df = DataFrame(
        {
            "region": ["a", "a", "a", "b", "b"],
            "cars": [1.0, np.nan, 3.0, np.nan, np.nan],
        }
    )
    result = boxplot(
        df=df,
        groupby=["region"],
        whisker_type=whisker_type,
        metrics=["cars"],
        percentiles=[10, 90],
    )

    counts = dict(zip(result["region"], result["cars__count"], strict=True))
    assert counts == {"a": 2, "b": 0}


@pytest.mark.parametrize("whisker_type", list(PostProcessingBoxplotWhiskerType))
@pytest.mark.parametrize("groupby", [[], ["region"], ["region", "kind"]])
def test_boxplot_density_preserves_statistics_and_matches_groups(
    whisker_type: PostProcessingBoxplotWhiskerType, groupby: list[str]
) -> None:
    """Curves match their group/metric and do not change any box statistics."""
    source = DataFrame(
        {
            "region": ["west", "east"] * 5,
            "kind": ["a", "b", "b", "a", "a", "b", "b", "a", "a", "b"],
            "AVG(income)": [1.0, 20.0, 2.0, 30.0, 3.0, 40.0, 4.0, 50.0, 100.0, 60.0],
            "count(*)": [10.0, 5.0, 10.0, 4.0, 10.0, 3.0, 10.0, 2.0, 10.0, 1.0],
        }
    )
    metrics = ["AVG(income)", "count(*)"]
    baseline = boxplot(source.copy(), groupby, metrics, whisker_type, [10, 90])
    result = boxplot(
        source.copy(),
        groupby,
        metrics,
        whisker_type,
        [10, 90],
        density_points=100,
        density_bandwidth=1.3,
    )
    density_columns = [f"{metric}__density" for metric in metrics]
    assert list(result.columns) == [*baseline.columns, *density_columns]
    assert_frame_equal(result.drop(columns=density_columns), baseline)
    for _, row in result.iterrows():
        observations = source
        for column in groupby:
            observations = observations[observations[column] == row[column]]
        for metric in metrics:
            curve = row[f"{metric}__density"]
            assert curve == estimate_density(observations[metric], 100, 1.3)["points"]
            assert curve[0][0] == observations[metric].min()
            assert curve[-1][0] == observations[metric].max()
    json.dumps(result.to_dict(orient="records"), allow_nan=False)


def test_boxplot_density_handles_missing_and_constant_observations() -> None:
    """Numeric strings coerce correctly; empty and constant groups keep their shape."""
    source = DataFrame(
        {
            "g": ["empty", "empty", "constant", "constant", "mixed", "mixed", "mixed"],
            "v": [None, "bad", "7", "7", "1", "3", None],
        }
    )
    result = boxplot(
        source,
        ["g"],
        ["v"],
        PostProcessingBoxplotWhiskerType.TUKEY,
        density_points=100,
    ).set_index("g")
    assert result.loc["empty", "v__density"] == []
    assert result.loc["constant", "v__density"] == [[7.0, 1.0]]
    assert len(result.loc["mixed", "v__density"]) == 100
    assert result.loc["mixed", "v__density"] == estimate_density([1.0, 3.0])["points"]


def test_boxplot_density_filters_nonfinite_observations() -> None:
    """Nonfinite metric values cannot leak into the density curve."""
    result = boxplot(
        DataFrame({"v": [1.0, 2.0, 3.0, np.nan, np.inf, -np.inf]}),
        [],
        ["v"],
        PostProcessingBoxplotWhiskerType.MINMAX,
        density_points=100,
    )
    curve = result.loc[0, "v__density"]
    assert curve == estimate_density([1.0, 2.0, 3.0])["points"]
    json.dumps(curve, allow_nan=False)


def test_boxplot_density_disabled_skips_estimation(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Neither absent points nor explicit null enables density calculations."""

    def unexpected_density(*args: object, **kwargs: object) -> None:
        """Fail if the box-only path attempts a density calculation."""
        raise AssertionError("density was called for a box plot")

    monkeypatch.setattr(
        import_module("superset.utils.pandas_postprocessing.boxplot"),
        "make_density_operators",
        unexpected_density,
    )
    source = DataFrame({"v": [1.0, 2.0, 3.0]})
    baseline = boxplot(source.copy(), [], ["v"], PostProcessingBoxplotWhiskerType.TUKEY)
    disabled = boxplot(
        source.copy(),
        [],
        ["v"],
        PostProcessingBoxplotWhiskerType.TUKEY,
        density_points=None,
        density_bandwidth=2.0,
    )
    assert_frame_equal(disabled, baseline)
    assert "v__density" not in disabled.columns


@pytest.mark.parametrize(
    "points,bandwidth",
    [
        (19, 1.0),
        (501, 1.0),
        (True, 1.0),
        (20.5, 1.0),
        ("100", 1.0),
        (100, 0.05),
        (100, 5.1),
        (100, True),
        (100, "1"),
        (100, float("nan")),
        (100, float("inf")),
    ],
)
def test_boxplot_rejects_invalid_density_settings(
    points: int, bandwidth: float
) -> None:
    """Runtime validation protects requests that bypass the options schema."""
    with pytest.raises(InvalidPostProcessingError):
        boxplot(
            DataFrame({"v": []}),
            [],
            ["v"],
            PostProcessingBoxplotWhiskerType.TUKEY,
            density_points=points,
            density_bandwidth=bandwidth,
        )


@pytest.mark.parametrize("points", [20, 500])
def test_boxplot_density_accepts_point_bounds(points: int) -> None:
    """Both documented point limits are accepted by the integrated operation."""
    result = boxplot(
        DataFrame({"v": [1.0, 2.0, 3.0]}),
        [],
        ["v"],
        PostProcessingBoxplotWhiskerType.TUKEY,
        density_points=points,
    )
    assert len(result.loc[0, "v__density"]) == points


@pytest.mark.parametrize("groupby", [[], ["g"]])
def test_boxplot_density_with_empty_input(groupby: list[str]) -> None:
    """Empty query results retain the density column without inventing groups."""
    result = boxplot(
        DataFrame({"g": [], "v": []}),
        groupby,
        ["v"],
        PostProcessingBoxplotWhiskerType.TUKEY,
        density_points=100,
    )
    assert result.empty
    assert "v__density" in result.columns


@pytest.mark.parametrize(
    "values",
    [
        pd.date_range("2020-01-01", periods=3),
        pd.to_timedelta([1, 2, 3], unit="D"),
    ],
)
def test_boxplot_density_rejects_temporal_metrics(values: pd.Index) -> None:
    """Boxplot coercion must not turn dates or timedeltas into density metrics."""
    with pytest.raises(InvalidPostProcessingError, match="Density requires numeric"):
        boxplot(
            DataFrame({"v": values}),
            [],
            ["v"],
            PostProcessingBoxplotWhiskerType.TUKEY,
            density_points=100,
        )
