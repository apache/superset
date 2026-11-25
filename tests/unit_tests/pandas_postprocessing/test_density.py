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
import logging
from typing import Any

import numpy as np
import pandas as pd
import pytest

from superset.exceptions import InvalidPostProcessingError
from superset.utils import json
from superset.utils.pandas_postprocessing import density as density_module
from superset.utils.pandas_postprocessing.density import (
    _bandwidth,
    estimate_density,
    make_density_operators,
    validate_density_settings,
)

# Max |binned - direct| relative to the direct peak, on the fixtures below.
KDE_TOLERANCE = 0.02


def _unimodal() -> np.ndarray:
    return np.random.default_rng(0).normal(10, 2, 500)


def _bimodal() -> np.ndarray:
    rng = np.random.default_rng(1)
    return np.concatenate([rng.normal(0, 1, 300), rng.normal(8, 1.5, 300)])


def _skewed() -> np.ndarray:
    return np.random.default_rng(2).lognormal(0, 0.8, 500)


def _area(points: list[list[float]]) -> float:
    xs = np.array([p[0] for p in points])
    ys = np.array([p[1] for p in points])
    return float(np.sum((ys[1:] + ys[:-1]) * np.diff(xs)) / 2)


def _direct_kde(x: np.ndarray, grid: np.ndarray, h: float) -> np.ndarray:
    z = (grid[:, None] - x[None, :]) / h
    y = np.exp(-0.5 * z * z).sum(axis=1) / (len(x) * h * np.sqrt(2 * np.pi))
    area = np.sum((y[1:] + y[:-1]) * np.diff(grid)) / 2
    return y / area


@pytest.mark.parametrize("make", [_unimodal, _bimodal, _skewed])
def test_density_shape(make) -> None:
    x = make()
    result = estimate_density(x, 64, 1.0)
    pts = result["points"]
    assert result["status"] == "ok"
    assert result["count"] == len(x)
    assert len(pts) == 64
    xs = [p[0] for p in pts]
    assert xs == sorted(xs)
    assert xs[0] == pytest.approx(x.min())
    assert xs[-1] == pytest.approx(x.max())
    assert all(np.isfinite(p[1]) and p[1] >= 0 for p in pts)
    assert _area(pts) == pytest.approx(1.0, abs=1e-9)
    json.dumps(result, allow_nan=False, ignore_nan=False)


@pytest.mark.parametrize("make", [_unimodal, _bimodal, _skewed])
@pytest.mark.parametrize("multiplier", [0.5, 1.0, 2.0])
def test_binned_matches_direct_kde(make, multiplier) -> None:
    x = make()
    pts = estimate_density(x, 128, multiplier)["points"]
    grid = np.array([p[0] for p in pts])
    binned = np.array([p[1] for p in pts])
    direct = _direct_kde(x, grid, _bandwidth(x, multiplier))
    assert np.max(np.abs(binned - direct)) / direct.max() < KDE_TOLERANCE


def test_bimodal_has_two_peaks() -> None:
    ys = np.array([p[1] for p in estimate_density(_bimodal(), 128)["points"]])
    peaks = np.sum((ys[1:-1] > ys[:-2]) & (ys[1:-1] > ys[2:]))
    assert peaks == 2


def test_larger_bandwidth_is_smoother() -> None:
    x = _bimodal()
    rough = np.array([p[1] for p in estimate_density(x, 128, 0.1)["points"]])
    smooth = np.array([p[1] for p in estimate_density(x, 128, 5.0)["points"]])
    assert np.abs(np.diff(rough)).sum() > np.abs(np.diff(smooth)).sum()


@pytest.mark.parametrize(
    "values",
    [[], [None, None], [np.nan, np.nan], [np.inf, -np.inf], ["a", "b"]],
)
def test_empty(values) -> None:
    result = estimate_density(pd.Series(values, dtype=object))
    assert result == {"points": [], "count": 0, "status": "empty"}


def test_numeric_strings_are_converted() -> None:
    result = estimate_density(pd.Series(["1", "2.5", "4", "x", "7"]))
    assert result["count"] == 4


def test_nan_and_infinity_are_ignored_in_count() -> None:
    x = pd.Series([1.0, 2.0, 3.0, np.nan, np.inf, -np.inf, None, 4.0])
    result = estimate_density(x)
    assert result["count"] == 4
    assert result["status"] == "ok"
    json.dumps(result, allow_nan=False, ignore_nan=False)


def test_single_value_is_constant() -> None:
    assert estimate_density([5.0]) == {
        "points": [[5.0, 1.0]],
        "count": 1,
        "status": "constant",
    }


def test_constant_group() -> None:
    result = estimate_density([3.0] * 50)
    assert result["status"] == "constant"
    assert result["count"] == 50
    assert result["points"] == [[3.0, 1.0]]


def test_spread_below_relative_epsilon_is_constant() -> None:
    base = 1e6
    x = np.array([base, np.nextafter(base, np.inf), base])
    assert x.max() - x.min() <= 1e-12 * base
    assert estimate_density(x)["status"] == "constant"


def test_real_small_spread_is_not_constant() -> None:
    x = 1e6 + np.arange(10) * 1e-4
    assert estimate_density(x)["status"] == "ok"


@pytest.mark.parametrize("scale", [1e-15, 1e-100, 1e-300])
def test_tiny_magnitude_data_is_not_constant(scale) -> None:
    result = estimate_density(_unimodal() * scale)
    assert result["status"] == "ok"
    assert len(result["points"]) == 100
    json.dumps(result, allow_nan=False, ignore_nan=False)


def test_overflowing_range_falls_back_with_log(caplog) -> None:
    with caplog.at_level(logging.WARNING, logger=density_module.logger.name):
        result = estimate_density([-1e308, 1e308, 0.0])
    assert result["status"] == "constant"
    assert result["count"] == 3
    assert "overflows" in caplog.text


def _assert_finite_and_json_safe(result: dict[str, Any]) -> None:
    flat = [v for pair in result["points"] for v in pair]
    assert np.all(np.isfinite(flat))
    json.dumps(result, allow_nan=False, ignore_nan=False)


@pytest.mark.parametrize(
    "values",
    [
        [1e308, 1.5e308],
        [-1.5e308, -1e308],
        [1.7e308, 1.79e308],
        [1e308, 1.2e308, 1.5e308, 1.1e308],
        [-1e308, 1e307],
    ],
)
def test_values_near_float_limit_stay_finite(values) -> None:
    result = estimate_density(values)
    assert result["status"] == "ok"
    assert result["count"] == len(values)
    _assert_finite_and_json_safe(result)
    xs = [p[0] for p in result["points"]]
    assert xs == sorted(xs)
    assert xs[0] == min(values)
    assert xs[-1] == max(values)
    assert all(p[1] >= 0 for p in result["points"])


def test_values_near_float_limit_keep_area_one() -> None:
    pts = estimate_density([1e308, 1.5e308])["points"]
    assert _area(pts) == pytest.approx(1.0, rel=1e-6)


@pytest.mark.parametrize("scale", [1e300, 1e305, 1e307])
def test_large_magnitude_data_stays_finite(scale) -> None:
    result = estimate_density(_unimodal() * scale)
    assert result["status"] == "ok"
    _assert_finite_and_json_safe(result)


def test_overflowing_range_marker_is_finite() -> None:
    # Even-sized: a plain np.median would overflow to inf here.
    result = estimate_density([-1.7e308, 1.7e308, 1.7e308, 1.7e308])
    assert result["status"] == "constant"
    _assert_finite_and_json_safe(result)


@pytest.mark.parametrize(
    "values",
    [
        [0.0, 1e-320],
        [0, 0, 0, 1e-320],
        [0.0, 5e-324],
        [0.0, 5e-324, 1e-323, 5e-324, 0.0],
        [-1e-320, 1e-320],
        [1e-310, 2e-310, 3e-310],
    ],
)
def test_denormal_range_does_not_raise(values) -> None:
    result = estimate_density(values)
    assert result["status"] in {"ok", "constant"}
    assert result["count"] == len(values)
    _assert_finite_and_json_safe(result)
    lo, hi = min(values), max(values)
    assert all(lo <= p[0] <= hi for p in result["points"])


@pytest.mark.parametrize(
    "values,expected",
    [
        ([3.0], 3.0),
        ([1.0, 5.0, 2.0], 2.0),
        ([1.0, 2.0, 3.0, 4.0], 2.5),
        ([-1.7e308, 1.7e308], 0.0),
        ([1.7e308, 1.7e308], 1.7e308),
        ([0.0, 1e-320], 5e-321),
    ],
)
def test_safe_median(values, expected) -> None:
    assert density_module._safe_median(np.array(values)) == pytest.approx(expected)


def test_subnormal_spread_does_not_crash() -> None:
    x = np.array([0.0, 5e-324, 1e-323, 5e-324])
    result = estimate_density(x)
    assert result["status"] in {"ok", "constant"}
    json.dumps(result, allow_nan=False, ignore_nan=False)


def test_zero_iqr_with_outliers_is_not_a_spike() -> None:
    x = np.array([0.0] * 95 + [10.0, 20.0, 30.0, 40.0, 50.0])
    result = estimate_density(x)
    assert result["status"] == "ok"
    assert _area(result["points"]) == pytest.approx(1.0, abs=1e-9)
    assert _bandwidth(x, 1.0) > (x.max() - x.min()) / 1024


@pytest.mark.parametrize("scale", [1e-12, 1e-9, 1.0, 1e9, 1e12])
def test_very_small_and_large_scales(scale) -> None:
    x = _unimodal() * scale
    result = estimate_density(x)
    assert result["status"] == "ok"
    assert all(np.isfinite(p[1]) for p in result["points"])
    json.dumps(result, allow_nan=False, ignore_nan=False)


def test_unusable_normalization_falls_back_with_log(monkeypatch, caplog) -> None:
    monkeypatch.setattr(density_module, "_trapezoid_area", lambda g, d: 0.0)
    with caplog.at_level(logging.WARNING, logger=density_module.logger.name):
        result = estimate_density(_unimodal())
    assert result["status"] == "constant"
    assert result["count"] == 500
    assert len(result["points"]) == 1
    assert "falling back" in caplog.text


def test_datetime_is_rejected() -> None:
    with pytest.raises(InvalidPostProcessingError):
        estimate_density(pd.Series(pd.date_range("2020-01-01", periods=5)))


@pytest.mark.parametrize(
    "points,bandwidth",
    [
        (True, 1.0),
        (64.0, 1.0),
        ("64", 1.0),
        (None, 1.0),
        (19, 1.0),
        (501, 1.0),
        (0, 1.0),
        (-5, 1.0),
        (64, True),
        (64, "1"),
        (64, None),
        (64, 0),
        (64, -1.0),
        (64, 0.05),
        (64, 5.01),
        (64, float("nan")),
        (64, float("inf")),
        (64, float("-inf")),
    ],
)
def test_invalid_settings(points, bandwidth) -> None:
    with pytest.raises(InvalidPostProcessingError):
        validate_density_settings(points, bandwidth)
    with pytest.raises(InvalidPostProcessingError):
        estimate_density([1.0, 2.0, 3.0], points, bandwidth)
    with pytest.raises(InvalidPostProcessingError):
        make_density_operators(points, bandwidth)


@pytest.mark.parametrize("points", [20, 100, 500])
@pytest.mark.parametrize("bandwidth", [0.1, 1.0, 5.0])
def test_valid_settings_bounds(points, bandwidth) -> None:
    validate_density_settings(points, bandwidth)
    assert len(estimate_density(_unimodal(), points, bandwidth)["points"]) == points


def test_numpy_integer_points_are_accepted() -> None:
    validate_density_settings(np.int64(32), np.float64(1.5))


def test_default_points_and_bounds() -> None:
    assert density_module.DENSITY_POINTS_DEFAULT == 100
    assert (density_module.DENSITY_POINTS_MIN, density_module.DENSITY_POINTS_MAX) == (
        20,
        500,
    )
    assert len(estimate_density(_unimodal())["points"]) == 100


def test_only_density_operator_is_returned() -> None:
    ops = make_density_operators(32, 1.0)
    assert set(ops) == {"density"}
    series = pd.Series(_unimodal())
    assert ops["density"](series) == estimate_density(series, 32, 1.0)["points"]


def test_operator_works_with_groupby_agg() -> None:
    df = pd.DataFrame(
        {
            "g": ["a"] * 30 + ["b"] * 30 + ["c"] * 5,
            "v": list(_unimodal()[:30]) + [7.0] * 30 + [np.nan] * 5,
        }
    )
    ops = make_density_operators(20, 1.0)
    funcs = {f"v__{name}": ("v", fn) for name, fn in ops.items()}
    out = df.groupby("g").agg(**funcs).reset_index()
    assert list(out.columns) == ["g", "v__density"]
    assert len(out.loc[0, "v__density"]) == 20
    assert out.loc[1, "v__density"] == [[7.0, 1.0]]
    assert out.loc[2, "v__density"] == []
