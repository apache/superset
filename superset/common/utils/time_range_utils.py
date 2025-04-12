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

from datetime import datetime
from typing import Any, cast

from superset import app
from superset.common.query_object import QueryObject
from superset.utils.core import FilterOperator
from superset.utils.date_parser import get_since_until


def get_since_until_from_time_range(
    time_range: str | None = None,
    time_shift: str | None = None,
    extras: dict[str, Any] | None = None,
) -> tuple[datetime | None, datetime | None]:
    return get_since_until(
        relative_start=(extras or {}).get(
            "relative_start", app.config["DEFAULT_RELATIVE_START_TIME"]
        ),
        relative_end=(extras or {}).get(
            "relative_end", app.config["DEFAULT_RELATIVE_END_TIME"]
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
    if query_object.time_range:
        return get_since_until_from_time_range(
            time_range=query_object.time_range,
            time_shift=query_object.time_shift,
            extras=query_object.extras,
        )

    time_range = None
    for flt in query_object.filter:
        if flt.get("op") == FilterOperator.TEMPORAL_RANGE.value and isinstance(
            flt.get("val"), str
        ):
            time_range = cast(str, flt.get("val"))

    return get_since_until_from_time_range(
        time_range=time_range,
        time_shift=query_object.time_shift,
        extras=query_object.extras,
    )
