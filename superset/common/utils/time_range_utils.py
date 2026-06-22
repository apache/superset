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

from collections.abc import Iterator
from contextlib import contextmanager
from datetime import datetime
from typing import Any, cast
from zoneinfo import ZoneInfo

from flask import current_app

from superset.common.query_object import QueryObject
from superset.utils.core import FilterOperator
from superset.utils.date_parser import anchored_now, get_since_until
from superset.utils.timezones import is_valid_timezone


def get_presentation_relative_now(datasource: Any) -> datetime | None:
    """The dataset's presentation-zone current wall-clock, when zoning applies.

    Returns ``None`` — leaving relative parsing anchored at the server's local
    clock, the historical behaviour — unless the feature flag is on and the
    datasource is a dataset with a presentation zone on a supporting engine
    (the same gate as SQL generation, so relative ranges and the SQL they feed
    resolve in the same zone). Duck-typed because SQL Lab ``Query``
    datasources share the call sites but deliberately lack the concept.
    """
    from superset import is_feature_enabled  # noqa: PLC0415 (circular import)

    zone = getattr(datasource, "presentation_timezone", None)
    if not zone or not is_feature_enabled("DATASET_PRESENTATION_TIMEZONE"):
        return None
    spec = getattr(datasource, "db_engine_spec", None)
    if spec is None or not spec.supports_presentation_timezone:
        return None
    if not is_valid_timezone(zone):
        # A zone persisted through a path that skipped validation (e.g. the
        # legacy datasource-save view) must not 500 the query here; SQL
        # generation's own allowlist will reject it loudly downstream.
        return None
    return datetime.now(ZoneInfo(zone)).replace(tzinfo=None)


@contextmanager
def presentation_zone_anchor(datasource: Any) -> Iterator[None]:
    """Anchor relative date parsing in the datasource's presentation zone.

    A no-op when zoning does not apply (``get_presentation_relative_now``
    returns ``None``). Every site that resolves a relative time expression for
    a chart query must run inside this block, or "today"/"Last week" silently
    fall back to the server's clock.
    """
    with anchored_now(get_presentation_relative_now(datasource)):
        yield


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
    with presentation_zone_anchor(query_object.datasource):
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
