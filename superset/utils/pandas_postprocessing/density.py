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
"""
Private helper that computes a binned Gaussian kernel density estimate (KDE).

It is used by the ``boxplot`` post-processing operation to draw violin shapes.
It is intentionally *not* exported from ``pandas_postprocessing/__init__.py``,
so it is not available as a public post-processing operation.
"""

from __future__ import annotations

import logging
import numbers
from collections.abc import Callable, Sequence
from typing import Any

import numpy as np
import pandas as pd
from flask_babel import gettext as _
from pandas.api.types import is_datetime64_any_dtype, is_timedelta64_dtype

from superset.exceptions import InvalidPostProcessingError

logger = logging.getLogger(__name__)

DENSITY_POINTS_DEFAULT = 100
DENSITY_POINTS_MIN = 20
DENSITY_POINTS_MAX = 500
DENSITY_BANDWIDTH_DEFAULT = 1.0
DENSITY_BANDWIDTH_MIN = 0.1
DENSITY_BANDWIDTH_MAX = 5.0

STATUS_OK = "ok"
STATUS_EMPTY = "empty"
STATUS_CONSTANT = "constant"

NUM_BINS = 512
# A group whose spread is below this fraction of its magnitude is "constant".
RELATIVE_EPSILON = 1e-12
# The IQR of a normal distribution is about 1.34 standard deviations.
IQR_TO_STD = 1.34
SILVERMAN_FACTOR = 0.9


def validate_density_settings(points: Any, bandwidth: Any) -> None:
    """
    Validate the density settings.

    :param points: number of grid points, an integer in [20, 500]
    :param bandwidth: positive finite multiplier in [0.1, 5]
    :raises InvalidPostProcessingError: If either setting is invalid
    """
    if (
        isinstance(points, bool)
        or not isinstance(points, numbers.Integral)
        or not DENSITY_POINTS_MIN <= int(points) <= DENSITY_POINTS_MAX
    ):
        raise InvalidPostProcessingError(
            _(
                "density_points must be an integer between %(min)s and %(max)s",
                min=DENSITY_POINTS_MIN,
                max=DENSITY_POINTS_MAX,
            )
        )
    if (
        isinstance(bandwidth, (bool, np.bool_))
        or not isinstance(bandwidth, numbers.Real)
        or not np.isfinite(float(bandwidth))
        or not DENSITY_BANDWIDTH_MIN <= float(bandwidth) <= DENSITY_BANDWIDTH_MAX
    ):
        raise InvalidPostProcessingError(
            _(
                "density_bandwidth must be a number between %(min)s and %(max)s",
                min=DENSITY_BANDWIDTH_MIN,
                max=DENSITY_BANDWIDTH_MAX,
            )
        )


def _finite_values(values: pd.Series | Sequence[Any] | np.ndarray) -> np.ndarray:
    """
    Return the finite numeric observations as a float64 array.

    Nulls, NaN, infinities and non-numeric strings are dropped. Numeric strings
    are converted.

    :raises InvalidPostProcessingError: for datetime or timedelta data
    """
    series = values if isinstance(values, pd.Series) else pd.Series(values)
    if is_datetime64_any_dtype(series.dtype) or is_timedelta64_dtype(series.dtype):
        raise InvalidPostProcessingError(_("Density requires numeric values"))
    numeric = pd.to_numeric(series, errors="coerce")
    array = numeric.to_numpy(dtype=np.float64, na_value=np.nan)
    return array[np.isfinite(array)]


def _result(points: list[list[float]], count: int, status: str) -> dict[str, Any]:
    return {"points": points, "count": count, "status": status}


def _constant_result(value: float, count: int) -> dict[str, Any]:
    return _result([[float(value), 1.0]], count, STATUS_CONSTANT)


def _safe_median(x: np.ndarray) -> float:
    """
    Median that cannot overflow.

    ``np.median`` averages the two middle values of an even-sized array, which
    overflows to infinity for values near the float limit. Halving each value
    first keeps the result finite and between the two middle values.
    """
    ordered = np.sort(x)
    mid = len(ordered) // 2
    if len(ordered) % 2:
        return float(ordered[mid])
    return float(ordered[mid - 1] * 0.5 + ordered[mid] * 0.5)


def _bandwidth(x: np.ndarray, multiplier: float) -> float:
    """
    Silverman-style bandwidth using a robust scale, scaled by ``multiplier``.

    The floor is relative to the data range (half a histogram bin), because the
    binned estimator cannot resolve anything narrower than that.
    """
    n = len(x)
    spread = float(x.max() - x.min())
    std = float(np.std(x, ddof=1))
    q1, q3 = np.percentile(x, [25, 75])
    iqr = float(q3 - q1)
    scale = std if iqr <= 0 else min(std, iqr / IQR_TO_STD)
    h = SILVERMAN_FACTOR * scale * n**-0.2 * multiplier
    floor = spread / (2 * NUM_BINS)
    if not np.isfinite(h):
        return floor
    return max(h, floor)


def _trapezoid_area(grid: np.ndarray, density: np.ndarray) -> float:
    return float(np.sum((density[1:] + density[:-1]) * np.diff(grid)) / 2.0)


def estimate_density(
    values: pd.Series | Sequence[Any] | np.ndarray,
    points: int = DENSITY_POINTS_DEFAULT,
    bandwidth: float = DENSITY_BANDWIDTH_DEFAULT,
) -> dict[str, Any]:
    """
    Estimate a Gaussian KDE on a regular grid, using binned data.

    Observations are put in 512 bins and the kernel is evaluated against the
    bin centers, so the cost is O(N + B*M) instead of O(N*M). Only one
    group/metric is processed per call, and nothing of size N x M is allocated.

    The curve is cut at the observed min and max and normalized so that its
    trapezoid area is 1. The computation runs on values rescaled to [0, 1], so
    very large, very small or very narrow data does not overflow bin edges or
    bin widths. If the range overflows, the heights overflow (a range narrower
    than about 1e-300 needs heights above the float limit) or the normalization
    is unusable, a warning is logged and a finite constant marker is returned
    instead of raising.

    :param values: observations of a single group/metric
    :param points: number of grid points (20-500)
    :param bandwidth: multiplier on the automatic bandwidth (0.1-5)
    :return: ``{"points": [[x, density], ...], "count": int, "status": str}``
        where status is ``ok``, ``empty`` or ``constant`` and count is the
        number of finite observations used
    :raises InvalidPostProcessingError: If the settings are invalid
    """
    validate_density_settings(points, bandwidth)
    points = int(points)
    multiplier = float(bandwidth)

    x = _finite_values(values)
    n = len(x)
    if n == 0:
        return _result([], 0, STATUS_EMPTY)

    x_min, x_max = float(x.min()), float(x.max())
    spread = x_max - x_min
    if not np.isfinite(spread):
        logger.warning(
            "Density range overflows (min=%s, max=%s, n=%s); "
            "falling back to a constant marker",
            x_min,
            x_max,
            n,
        )
        return _constant_result(_safe_median(x), n)
    if spread <= RELATIVE_EPSILON * max(abs(x_min), abs(x_max)):
        return _constant_result(x_min, n)

    # Work on values rescaled to [0, 1]. Bin edges, bin centers and the
    # bandwidth then never overflow or underflow, whatever the magnitude or
    # spread of the data. Only the final grid and heights are mapped back.
    u = np.clip((x - x_min) / spread, 0.0, 1.0)
    h = _bandwidth(u, multiplier)
    counts, edges = np.histogram(u, bins=NUM_BINS, range=(0.0, 1.0))
    centers = (edges[:-1] + edges[1:]) / 2.0
    grid_u = np.linspace(0.0, 1.0, points)

    # (M, B) matrix: bounded by points * NUM_BINS, independent of N.
    z = (grid_u[:, None] - centers[None, :]) / h
    density_u = (np.exp(-0.5 * z * z) * counts[None, :]).sum(axis=1) / (
        n * h * np.sqrt(2.0 * np.pi)
    )

    area = _trapezoid_area(grid_u, density_u)
    if not np.all(np.isfinite(density_u)) or not np.isfinite(area) or area <= 0:
        logger.warning(
            "Density normalization unusable (area=%s, n=%s, h=%s); "
            "falling back to a constant marker",
            area,
            n,
            h,
        )
        return _constant_result(_safe_median(x), n)

    # Heights in the original units: area 1 over [x_min, x_max] means dividing by
    # the spread. For a very narrow range this exceeds the float range.
    with np.errstate(over="ignore", under="ignore", divide="ignore"):
        density = density_u / area / spread
    if not np.all(np.isfinite(density)):
        logger.warning(
            "Density heights overflow (spread=%s, n=%s); "
            "falling back to a constant marker",
            spread,
            n,
        )
        return _constant_result(_safe_median(x), n)

    grid = np.clip(x_min + grid_u * spread, x_min, x_max)
    grid[0], grid[-1] = x_min, x_max
    return _result(
        [[float(a), float(b)] for a, b in zip(grid, density, strict=True)],
        n,
        STATUS_OK,
    )


def make_density_operators(
    points: int = DENSITY_POINTS_DEFAULT,
    bandwidth: float = DENSITY_BANDWIDTH_DEFAULT,
) -> dict[str, Callable[[pd.Series], Any]]:
    """
    Build the ``density`` operator used by ``boxplot``.

    The operator maps one group's ``Series`` to a single cell value (a list of
    ``[value, density]`` pairs), so it works with ``aggregate()``. The key is
    the operator name, so the output column is ``<metric>__density``. An empty
    group yields ``[]`` and a constant group yields ``[[value, 1.0]]``.

    :param points: number of grid points (20-500)
    :param bandwidth: multiplier on the automatic bandwidth (0.1-5)
    :raises InvalidPostProcessingError: If the settings are invalid
    """
    validate_density_settings(points, bandwidth)

    def density(series: pd.Series) -> list[list[float]]:
        return estimate_density(series, points, bandwidth)["points"]

    return {"density": density}
