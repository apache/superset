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
from datetime import datetime
from typing import Optional, Union

import pandas as pd
from flask_babel import gettext as _

from superset.exceptions import InvalidPostProcessingError
from superset.utils.pandas_postprocessing.utils import RESAMPLE_METHOD


def _align_time_range_tz(
    value: Optional[Union[datetime, str]], index: pd.DatetimeIndex
) -> Optional[pd.Timestamp]:
    """
    Make a query time boundary's timezone-awareness match a DatetimeIndex's,
    so the two can be combined as a resample ``origin`` or in
    ``pd.date_range``/``reindex`` without pandas raising a "must have the
    same timezone" error. Boundaries are naive by convention (see
    ``QueryObject.from_dttm``/``to_dttm``), while the DataFrame index can be
    timezone-aware for datasources with timezone-aware temporal columns.
    """
    if value is None:
        return None
    timestamp = pd.Timestamp(value)
    if index.tz is not None:
        return (
            timestamp.tz_localize(index.tz)
            if timestamp.tzinfo is None
            else timestamp.tz_convert(index.tz)
        )
    return timestamp.tz_localize(None) if timestamp.tzinfo is not None else timestamp


def resample(
    df: pd.DataFrame,
    rule: str,
    method: str,
    fill_value: Optional[Union[float, int]] = None,
    time_range_start: Optional[Union[datetime, str]] = None,
    time_range_end: Optional[Union[datetime, str]] = None,
) -> pd.DataFrame:
    """
    support upsampling in resample

    :param df: DataFrame to resample.
    :param rule: The offset string representing target conversion.
    :param method: How to fill the NaN value after resample.
    :param fill_value: What values do fill missing.
    :param time_range_start: Start of the query's time range (inclusive). When
        combined with ``time_range_end`` and zero-filling, buckets are
        generated across the full queried time range instead of only between
        the first and last existing data points.
    :param time_range_end: End of the query's time range (exclusive).
    :return: DataFrame after resample
    :raises InvalidPostProcessingError: If the request in incorrect
    """
    if not isinstance(df.index, pd.DatetimeIndex):
        raise InvalidPostProcessingError(_("Resample operation requires DatetimeIndex"))
    if method not in RESAMPLE_METHOD:
        raise InvalidPostProcessingError(
            _("Resample method should be in ") + ", ".join(RESAMPLE_METHOD) + "."
        )

    if method == "asfreq" and fill_value is not None:
        aligned_start = _align_time_range_tz(time_range_start, df.index)
        aligned_end = _align_time_range_tz(time_range_end, df.index)
        origin = aligned_start if aligned_start is not None else "start_day"
        _df = df.resample(rule, origin=origin).asfreq(fill_value=fill_value)
        if aligned_start is not None and aligned_end is not None:
            # Zero-filling should cover the entire queried time range, not
            # just the span between the first and last existing data points.
            # Union (rather than replace) the resampled labels with the
            # full-range grid: for calendar-anchored rules (e.g. month/
            # quarter/year start) `Resampler` ignores `origin` and always
            # bins to calendar boundaries, while `pd.date_range` rolls
            # forward from `start`, so the two can disagree near the range
            # boundary. Replacing the index instead of unioning it would
            # silently drop real data whose bucket falls outside the
            # generated grid.
            full_index = _df.index.union(
                pd.date_range(
                    start=aligned_start,
                    end=aligned_end,
                    freq=rule,
                    inclusive="left",
                )
            )
            _df = _df.reindex(full_index, fill_value=fill_value)
        _df = _df.fillna(fill_value)
    elif method == "linear":
        _df = df.resample(rule).interpolate()
    else:
        _df = getattr(df.resample(rule), method)()
        if method in ("ffill", "bfill"):
            _df = getattr(_df, method)()
    return _df
