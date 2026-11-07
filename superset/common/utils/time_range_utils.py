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
from __future__ import annotations

from collections.abc import Mapping, Sequence
from datetime import datetime
from typing import Any, cast

from flask import current_app
from flask_babel import gettext as _

from superset.common.query_object import QueryObject
from superset.constants import NO_TIME_RANGE
from superset.exceptions import QueryObjectValidationError
from superset.extensions import feature_flag_manager
from superset.superset_typing import Column
from superset.utils.core import (
    FilterOperator,
    get_x_axis_label,
)
from superset.utils.date_parser import (
    get_past_or_future,
    get_since_until,
    is_parseable_human_timedelta,
)


def get_time_range_from_filters(
    time_range: str | None,
    filters: Sequence[Mapping[str, object]] | None,
    columns: list[Column] | None,
) -> str:
    """Select the original range expression without evaluating relative dates."""
    if time_range is not None:
        return time_range
    temporal_filters: list[Mapping[str, object]] = [
        filter_
        for filter_ in filters or []
        if filter_.get("op") == FilterOperator.TEMPORAL_RANGE
        and isinstance(filter_.get("val"), str)
    ]
    if not temporal_filters:
        return NO_TIME_RANGE
    x_axis_label: str | None = get_x_axis_label(columns)
    selected: Mapping[str, object] = next(
        (filter_ for filter_ in temporal_filters if filter_.get("col") == x_axis_label),
        temporal_filters[0],
    )
    return cast(str, selected.get("val"))


def get_since_until_from_time_range(
    time_range: str | None = None,
    time_shift: str | None = None,
    extras: dict[str, Any] | None = None,
) -> tuple[datetime | None, datetime | None]:
    return get_since_until(
        relative_start=(extras or {}).get(
            "relative_start", current_app.config["DEFAULT_RELATIVE_START_TIME"]
        ),
        relative_end=(extras or {}).get(
            "relative_end", current_app.config["DEFAULT_RELATIVE_END_TIME"]
        ),
        time_range=time_range,
        time_shift=time_shift,
        instant_time_comparison_range=(extras or {}).get(
            "instant_time_comparison_range"
        ),
    )


def is_valid_date(date_string: str) -> bool:
    try:
        datetime.strptime(date_string, "%Y-%m-%d")
        return True
    except ValueError:
        return False


def is_valid_date_range(date_range: str) -> bool:
    try:
        start_date, end_date = date_range.split(":")
        datetime.strptime(start_date.strip(), "%Y-%m-%d")
        datetime.strptime(end_date.strip(), "%Y-%m-%d")
        return True
    except ValueError:
        return False


def get_offset_custom_or_inherit(
    offset: str,
    outer_from_dttm: datetime,
    outer_to_dttm: datetime,
) -> str:
    """
    Get the time offset for custom or inherit.

    :param offset: The offset string.
    :param outer_from_dttm: The outer from datetime.
    :param outer_to_dttm: The outer to datetime.
    :returns: The time offset.
    """
    if offset == "inherit":
        # Shift back by the full length of the range, so the comparison
        # covers the period immediately preceding it. The duration is
        # expressed in seconds rather than days because ``timedelta.days``
        # truncates: a 12-hour range would yield "0 days ago" and compare
        # the range against itself, and a 36-hour range would shift by a
        # single day and overlap it. Whole-day ranges resolve to the same
        # instant either way.
        duration = outer_to_dttm - outer_from_dttm
        return f"{int(duration.total_seconds())} seconds ago"
    if is_valid_date(offset):
        offset_date = datetime.strptime(offset, "%Y-%m-%d")
        return f"{(outer_from_dttm - offset_date).days} days ago"
    return ""


def get_time_offset_range(
    offset: str, since: datetime, until: datetime
) -> tuple[datetime | None, datetime | None]:
    """
    Return the range a time comparison offset compares ``since``/``until`` with.

    Handles a relative offset (``"1 year ago"``), a custom date (``"2025-01-01"``),
    ``"inherit"`` and, behind ``DATE_RANGE_TIMESHIFTS_ENABLED``, a date range
    (``"2025-01-01 : 2025-03-31"``).

    :raises QueryObjectValidationError: if the offset is a date range and
        ``DATE_RANGE_TIMESHIFTS_ENABLED`` is off, if the date range is invalid,
        or if a relative offset cannot be parsed.
    """
    if is_valid_date_range(offset):
        if not feature_flag_manager.is_feature_enabled("DATE_RANGE_TIMESHIFTS_ENABLED"):
            raise QueryObjectValidationError(
                "Date range timeshifts are not enabled. "
                "Please contact your administrator to enable the "
                "DATE_RANGE_TIMESHIFTS_ENABLED feature flag."
            )
        try:
            return get_since_until_from_time_range(time_range=offset)
        except ValueError as ex:
            raise QueryObjectValidationError(str(ex)) from ex

    if is_valid_date(offset) or offset == "inherit":
        offset = get_offset_custom_or_inherit(offset, since, until)
    elif not is_parseable_human_timedelta(offset):
        # get_past_or_future silently returns the source time for offsets it
        # cannot parse; querying with an unshifted window would present the
        # current period's data as the comparison series. The parse flag (not
        # a zero delta) is the unparseability signal, so legitimate zero-shift
        # offsets like "0 days ago" pass through.
        raise QueryObjectValidationError(
            _(
                "Unable to interpret the time offset: "
                "%(offset)s. Use a relative time such as "
                '"1 month ago".',
                offset=offset,
            )
        )
    return get_past_or_future(offset, since), get_past_or_future(offset, until)


# pylint: disable=invalid-name
def get_since_until_from_query_object(
    query_object: QueryObject,
) -> tuple[datetime | None, datetime | None]:
    """
    this function will return since and until by tuple if
    1) the time_range is in the query object.
    2) the x-axis column is in the columns field
       and its corresponding `temporal_range` filter is in the adhoc filters.
    :param query_object: a valid query object
    :return: since and until by tuple
    """
    if query_object.time_range:
        return get_since_until_from_time_range(
            time_range=query_object.time_range,
            time_shift=query_object.time_shift,
            extras=query_object.extras,
        )

    time_range = None
    for flt in query_object.filter:
        if flt.get("op") == FilterOperator.TEMPORAL_RANGE and isinstance(
            flt.get("val"), str
        ):
            time_range = cast(str, flt.get("val"))

    return get_since_until_from_time_range(
        time_range=time_range,
        time_shift=query_object.time_shift,
        extras=query_object.extras,
    )
