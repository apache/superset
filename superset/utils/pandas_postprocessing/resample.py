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
from flask_babel import gettext as _

from superset.exceptions import InvalidPostProcessingError
from superset.utils.pandas_postprocessing.utils import RESAMPLE_METHOD

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

    :param df: DataFrame to resample.
    :param rule: The offset string representing target conversion.
    :param method: How to fill the NaN value after resample.
    :param fill_value: What values do fill missing.
    :param time_range_start: Inclusive start of the period to cover. When set, the
                             result is padded so it starts at the beginning of the
                             period even if the data starts later.
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
    df = _pad_to_time_range(
        df,
        _coerce_bound(time_range_start, tz),
        _coerce_bound(time_range_end, tz),
    )

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
