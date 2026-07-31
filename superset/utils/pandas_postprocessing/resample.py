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
from datetime import datetime, tzinfo
from typing import Optional, Union

import pandas as pd
from flask import current_app, has_app_context
from flask_babel import gettext as _
from pandas.tseries.frequencies import to_offset

from superset.exceptions import InvalidPostProcessingError
from superset.utils.pandas_postprocessing.utils import (
    DEFAULT_MAX_RESAMPLE_BUCKETS,
    RESAMPLE_METHOD,
)

TimeBound = Union[datetime, str]


def _coerce_bound(
    value: Optional[TimeBound], tz: Optional[tzinfo]
) -> Optional[pd.Timestamp]:
    """
    Normalize a time range boundary into a ``Timestamp`` comparable with the index.

    :param value: Boundary as a datetime or a parseable string.
    :param tz: Timezone of the DataFrame index, if any.
    :return: Timestamp aligned with the index timezone awareness, or None.
    :raises InvalidPostProcessingError: If the boundary cannot be parsed.
    """
    if value is None:
        return None
    try:
        timestamp = pd.Timestamp(value)
    except (TypeError, ValueError) as ex:
        raise InvalidPostProcessingError(
            _("Invalid time range boundary for resample: %(value)s", value=value)
        ) from ex

    if timestamp.tzinfo is None:
        return timestamp if tz is None else timestamp.tz_localize(tz)
    # an index and a boundary in different timezones would append into an
    # object-dtype index that ``resample`` cannot bin
    return timestamp.tz_localize(None) if tz is None else timestamp.tz_convert(tz)


def _pad_to_time_range(
    df: pd.DataFrame,
    time_range_start: Optional[pd.Timestamp],
    time_range_end: Optional[pd.Timestamp],
) -> pd.DataFrame:
    """
    Add empty rows at the edges of the target period.

    ``DataFrame.resample`` derives its bins from the first and last index entries,
    so a series that only covers part of the requested time range is only filled
    between its own extremes. Anchoring the index to the boundaries of the period
    makes pandas emit buckets for the whole period instead.

    :param df: DataFrame with a DatetimeIndex.
    :param time_range_start: Inclusive lower boundary of the period.
    :param time_range_end: Exclusive upper boundary of the period.
    :return: DataFrame whose index spans the target period.
    """
    index = df.index
    anchors = []

    if time_range_start is not None and (index.empty or time_range_start < index.min()):
        anchors.append(time_range_start)

    if time_range_end is not None:
        # the upper boundary of a Superset time range is exclusive, so anchor on
        # the last instant that still belongs to the period
        last_instant = time_range_end - pd.Timedelta(1, unit="ns")
        if index.empty or last_instant > index.max():
            anchors.append(last_instant)

    if not anchors:
        return df

    # `copy` detaches the empty slice from the index engine of `df`, which would
    # otherwise refuse to reindex whenever `df` holds duplicate timestamps
    padding = df.iloc[:0].copy().reindex(pd.DatetimeIndex(anchors, name=index.name))
    return pd.concat([df, padding]).sort_index(kind="stable")


def _estimate_bucket_count(start: pd.Timestamp, end: pd.Timestamp, rule: str) -> int:
    """
    Estimate how many buckets ``resample(rule)`` would produce between two bounds
    without materializing the full index when the rule is a fixed duration.
    """
    if end < start:
        return 0
    offset = to_offset(rule)
    try:
        nanos = offset.nanos
    except ValueError:
        # Calendar frequencies (months, years, …) are coarse enough that
        # building the range for the estimate is cheap.
        return len(pd.date_range(start=start, end=end, freq=rule))
    return int((end - start) / pd.Timedelta(nanoseconds=nanos)) + 1


def _get_max_resample_buckets() -> int:
    """Return the configured padded-resample bucket cap."""
    if has_app_context():
        configured = current_app.config.get(
            "MAX_RESAMPLE_BUCKETS", DEFAULT_MAX_RESAMPLE_BUCKETS
        )
    else:
        configured = DEFAULT_MAX_RESAMPLE_BUCKETS
    try:
        normalized = int(configured)
    except (TypeError, ValueError):
        return DEFAULT_MAX_RESAMPLE_BUCKETS
    return normalized if normalized > 0 else DEFAULT_MAX_RESAMPLE_BUCKETS


def _validate_bucket_count(start: pd.Timestamp, end: pd.Timestamp, rule: str) -> None:
    try:
        estimated = _estimate_bucket_count(start, end, rule)
    except (TypeError, ValueError) as ex:
        raise InvalidPostProcessingError(
            _("Invalid resample rule: %(rule)s", rule=rule)
        ) from ex
    if estimated > (max_buckets := _get_max_resample_buckets()):
        raise InvalidPostProcessingError(
            _(
                "The resample operation generated too many time buckets "
                "(maximum allowed is %(max_buckets)s). Please use a larger "
                "time grain or a smaller time range.",
                max_buckets=max_buckets,
            )
        )


def resample(  # pylint: disable=too-many-arguments
    df: pd.DataFrame,
    rule: str,
    method: str,
    fill_value: Optional[Union[float, int]] = None,
    time_range_start: Optional[TimeBound] = None,
    time_range_end: Optional[TimeBound] = None,
) -> pd.DataFrame:
    """
    support upsampling in resample

    Note: If a query returns 0 rows, Superset's primary execution path in
    ``helpers.py`` skips ``exec_post_processing`` entirely. While ``resample``
    is fully equipped to expand empty DataFrames when given explicit bounds,
    zero-row query results will be returned as empty frames by upstream engine
    behavior.

    When ``time_range_start`` / ``time_range_end`` are set, the number of buckets
    that would be materialized is capped by ``MAX_RESAMPLE_BUCKETS`` (default
    50000). Unbounded resamples of existing data are not subject to that cap.

    :param df: DataFrame to resample.
    :param rule: The offset string representing target conversion.
    :param method: How to fill the NaN value after resample.
    :param fill_value: What values do fill missing.
    :param time_range_start: Inclusive start of the period to cover. When set, the
                             result is padded so it starts at the beginning of the
                             period even if the data starts later. An empty
                             DataFrame with a DatetimeIndex is expanded into
                             zero-filled buckets across the period.
    :param time_range_end: Exclusive end of the period to cover. When set, the
                           result is padded so it ends at the end of the period
                           even if the data ends earlier.
    :return: DataFrame after resample
    :raises InvalidPostProcessingError: If the request in incorrect
    """
    if not isinstance(df.index, pd.DatetimeIndex):
        raise InvalidPostProcessingError(_("Resample operation requires DatetimeIndex"))
    if method not in RESAMPLE_METHOD:
        raise InvalidPostProcessingError(
            _("Resample method should be in ") + ", ".join(RESAMPLE_METHOD) + "."
        )

    tz = df.index.tz
    # Cap only the padded/bounded path. Unbounded resamples of existing data
    # must keep working for long historical series.
    apply_bucket_cap = time_range_start is not None or time_range_end is not None
    df = _pad_to_time_range(
        df,
        _coerce_bound(time_range_start, tz),
        _coerce_bound(time_range_end, tz),
    )
    # An empty frame with no time-range anchors has nothing to bin. Returning
    # early keeps the DatetimeIndex intact; ``resample`` on a zero-length index
    # would otherwise degrade it to an object Index.
    if df.empty:
        return df

    if apply_bucket_cap:
        _validate_bucket_count(df.index.min(), df.index.max(), rule)

    if method == "asfreq" and fill_value is not None:
        _df = df.resample(rule).asfreq(fill_value=fill_value)
        _df = _df.fillna(fill_value)
    elif method == "linear":
        _df = df.resample(rule).interpolate()
    else:
        _df = getattr(df.resample(rule), method)()
        if method in ("ffill", "bfill"):
            _df = getattr(_df, method)()
    return _df
