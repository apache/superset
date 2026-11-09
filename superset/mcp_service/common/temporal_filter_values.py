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

"""Validate SIMPLE filter comparators that target a temporal column.

The shared query path reads an all-digit string on a temporal column as epoch
milliseconds (drill-to-detail and cross-filters rely on that) and hands any
other string to the database untouched. A model that writes ``"2000"`` for
"since the year 2000" therefore filters on ``1970-01-01 00:00:02``, and one that
writes ``"not-a-date"`` gets a database error or a silently empty result. The
shared behaviour is deliberate, so MCP tools reject such values before a query
is built instead.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any

# Operators whose comparator is read as a point in time. LIKE-style operators
# take a text pattern and the null checks take no comparator.
TEMPORAL_COMPARISON_OPERATORS = frozenset(
    {"=", "==", "!=", ">", "<", ">=", "<=", "IN", "NOT IN"}
)

_ACCEPTED_FORMATS = (
    "Use an ISO 8601 date or datetime string such as '2000-01-01' or "
    "'2000-01-01T00:00:00', or a number for epoch milliseconds."
)


def invalid_temporal_filter_value(operator: str, value: Any) -> str | None:
    """Return why ``value`` is not a usable temporal comparator, else ``None``.

    Numbers are epoch milliseconds, as the shared query path reads them. Strings
    must be ISO 8601: a bare integer string is ambiguous between a year and an
    epoch, and any other format is a guess about day and month order.
    """
    if operator.upper() not in TEMPORAL_COMPARISON_OPERATORS or value is None:
        return None

    candidates = value if isinstance(value, (list, tuple)) else [value]
    for candidate in candidates:
        if isinstance(candidate, bool):
            return f"{candidate!r} is a boolean, not a date. {_ACCEPTED_FORMATS}"
        if isinstance(candidate, (int, float)):
            continue
        if isinstance(candidate, datetime):
            continue
        if not isinstance(candidate, str):
            return f"{candidate!r} is not a date. {_ACCEPTED_FORMATS}"
        text = candidate.strip()
        if text.lstrip("+-").isdigit():
            return (
                f"{candidate!r} is ambiguous: an all-digit string would be read "
                "as epoch milliseconds, not as a year. Write a year as "
                "'YYYY-01-01', or pass epoch milliseconds as a number."
            )
        try:
            datetime.fromisoformat(text)
        except ValueError:
            return f"{candidate!r} is not an ISO 8601 date. {_ACCEPTED_FORMATS}"
    return None
