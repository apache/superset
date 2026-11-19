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

from collections.abc import Collection, Mapping, Sequence
from datetime import datetime
from typing import Any, cast

from flask import current_app
from flask_babel import gettext as _
from marshmallow import ValidationError

from superset.common.query_object import QueryObject
from superset.constants import NO_TIME_RANGE
from superset.exceptions import QueryObjectValidationError
from superset.superset_typing import Column
from superset.utils.core import (
    FilterOperator,
    get_base_axis_columns,
)
from superset.utils.date_parser import get_since_until


def get_time_range_from_filters(
    time_range: str | None,
    filters: Sequence[Mapping[str, object]] | None,
    columns: list[Column] | None,
    temporal_columns: Collection[str] | None = None,
) -> str:
    """Select the original range expression without evaluating relative dates.

    A temporal x-axis only takes a range that targets it, by label first and
    then by expression. Without an x-axis, or with an x-axis whose expression
    is not one of ``temporal_columns``, the first temporal range is used.
    """
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
    base_axes: list[Column] = get_base_axis_columns(columns)
    if not base_axes or (
        temporal_columns is not None
        and cast(Mapping[str, object], base_axes[0]).get("sqlExpression")
        not in temporal_columns
    ):
        return cast(str, temporal_filters[0].get("val"))
    for identifier in get_column_identifiers(base_axes[0]):
        for filter_ in temporal_filters:
            if identifier in get_column_identifiers(filter_.get("col")):
                return cast(str, filter_.get("val"))
    return NO_TIME_RANGE


def get_column_identifiers(column: object) -> tuple[str, ...]:
    """Return the names a column is referenced by: its label, then expression."""
    if isinstance(column, str):
        return (column,)
    if isinstance(column, Mapping):
        return tuple(
            value
            for key in ("label", "sqlExpression")
            if isinstance(value := column.get(key), str) and value
        )
    return ()


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


# pylint: disable=invalid-name
def get_since_until_from_temporal_filter(
    time_range: str,
    column: str,
    time_shift: str | None = None,
    extras: dict[str, Any] | None = None,
) -> tuple[datetime | None, datetime | None]:
    """Parse one temporal filter's range, reporting a bad range as a bad request.

    ``get_time_range_from_filters`` picks a single temporal filter, and only
    that one is parsed while the query context is built, where
    ``ChartDataRestApi`` answers 400 for a range it cannot parse. Every temporal
    filter is parsed again when the SQL is built, and that runs outside the
    handlers that answer 400, so a bad range in any other filter would reach
    ``app.errorhandler(Exception)`` and answer 500.

    :param time_range: The range expression, as the filter carries it.
    :param column: The filtered column, to say which filter is at fault.
    :param time_shift: An offset to apply to the parsed range.
    :param extras: Query extras holding the relative-date anchors.
    :return: The parsed bounds
    :raises QueryObjectValidationError: If the range is unusable
    """
    try:
        return get_since_until_from_time_range(
            time_range=time_range,
            time_shift=time_shift,
            extras=extras,
        )
    except (ValidationError, ValueError) as ex:
        # ``TimeRangeParseFailError`` and ``TimeRangeAmbiguousError`` are
        # marshmallow ``ValidationError``s, which only the query-context
        # handlers answer 400 for; the rest arrive as a bare ``ValueError``.
        raise QueryObjectValidationError(
            _(
                "Invalid time range for %(column)s: %(message)s",
                column=column,
                message=str(ex),
            )
        ) from ex


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
