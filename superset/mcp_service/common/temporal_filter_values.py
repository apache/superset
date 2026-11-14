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

The shared query path reads an all-digit string on a native temporal column as epoch
milliseconds (drill-to-detail and cross-filters rely on that) and hands any
other string to the database untouched. A model that writes ``"2000"`` for
"since the year 2000" therefore filters on ``1970-01-01 00:00:02``, and one that
writes ``"not-a-date"`` gets a database error or a silently empty result. The
shared behaviour is deliberate, so MCP tools reject such values before a query
is built instead.
"""

from __future__ import annotations

import calendar
import re
from datetime import datetime, timezone
from typing import Any

from superset.constants import EMPTY_STRING, NULL_STRING
from superset.utils.core import EPOCH_FORMATS

# Operators whose comparator is read as a point in time. LIKE-style operators
# take a text pattern and the null checks take no comparator.
TEMPORAL_COMPARISON_OPERATORS = frozenset(
    {"=", "==", "!=", ">", "<", ">=", "<=", "IN", "NOT IN"}
)

# fromisoformat also accepts arbitrary separators, basic times, week dates and
# overflowing offset minutes. Those spellings are not portable SQL literals.
_SQL_ISO_DATE = re.compile(
    r"[0-9]{4}-[0-9]{2}-[0-9]{2}"
    r"(?:[T ][0-9]{2}:[0-9]{2}(?::[0-9]{2}(?:\.[0-9]{1,6})?)?"
    r"(?:Z|[+-](?:(?:0[0-9]|1[0-3]):[0-5][0-9]|14:00))?)?"
)

# strptime accepts unpadded numeric fields; %f and %z deliberately retain
# their supported variable-width spellings instead of strftime's canonical form.
_FIXED_WIDTH = {
    "%Y": r"[0-9]{4}",
    "%j": r"[0-9]{3}",
    **dict.fromkeys(
        ("%y", "%m", "%d", "%H", "%I", "%M", "%S", "%U", "%W", "%V"),
        r"[0-9]{2}",
    ),
}

_ACCEPTED_FORMATS = (
    "Use an ISO 8601 date or datetime string such as '2000-01-01' or "
    "'2000-01-01T00:00:00', or a number for epoch milliseconds."
)


def invalid_temporal_filter_value(
    operator: str, value: Any, *, python_date_format: str | None = None
) -> str | None:
    """Return why a comparator cannot be used by the shared SQL filter path.

    Native temporal columns accept extended ISO literals or finite, representable
    epoch milliseconds. Chart configurations trim surrounding whitespace before
    calling this validator; query_dataset preserves spaces and rejects them.
    For non-native temporal storage, callers supply the
    column's date format: those strings are compared as stored, not converted
    to ISO dates. Null membership entries retain the shared query semantics.
    """
    if operator.upper() not in TEMPORAL_COMPARISON_OPERATORS or value is None:
        return None

    candidates = value if isinstance(value, (list, tuple)) else [value]
    for candidate in candidates:
        # The shared handler strips only tabs/newlines before converting these
        # sentinels, and returns them before temporal conversion or parsing.
        if isinstance(candidate, str) and candidate.strip("\t\n") in {
            NULL_STRING,
            EMPTY_STRING,
        }:
            continue
        if candidate is None and operator.upper() in {"IN", "NOT IN"}:
            continue
        if reason := _invalid_temporal_candidate(candidate, python_date_format):
            return reason
    return None


def _invalid_temporal_candidate(
    candidate: Any, python_date_format: str | None
) -> str | None:
    """Check one non-null comparator in its column's SQL representation."""
    accepted = (
        f"Use a number in the column's {python_date_format!r} units."
        if python_date_format in EPOCH_FORMATS
        else _ACCEPTED_FORMATS
    )
    if isinstance(candidate, bool):
        return f"{candidate!r} is a boolean, not a date. {accepted}"
    if python_date_format and python_date_format not in EPOCH_FORMATS:
        return _invalid_temporal_string(str(candidate), python_date_format)
    if isinstance(candidate, (int, float)) or (
        isinstance(candidate, str) and python_date_format in EPOCH_FORMATS
    ):
        scale = EPOCH_FORMATS.get(python_date_format or "", 1000)
        try:
            epoch = float(candidate) if isinstance(candidate, str) else candidate
            datetime.fromtimestamp(epoch / scale, tz=timezone.utc)
        except (OverflowError, OSError, ValueError):
            return (
                f"{candidate!r} is not a finite, representable epoch value. {accepted}"
            )
        return None
    if isinstance(candidate, datetime):
        return None
    if not isinstance(candidate, str):
        return f"{candidate!r} is not a date. {accepted}"
    return _invalid_temporal_string(candidate, python_date_format)


def _invalid_temporal_string(
    candidate: str, python_date_format: str | None
) -> str | None:
    """Check the exact string representation that will reach SQL."""
    # Match the shared filter handler's whitespace handling, not str.strip():
    # leading/trailing spaces would otherwise be forwarded to SQL unchanged.
    text = candidate.strip("\t\n")
    if python_date_format:
        try:
            parsed = datetime.strptime(text, python_date_format)
            # strptime ignores name case and does not use standalone weekdays
            # to determine the date. Match their locale spellings explicitly.
            names = {
                "%a": calendar.day_abbr,
                "%A": calendar.day_name,
                "%b": calendar.month_abbr[1:],
                "%B": calendar.month_name[1:],
                "%p": [datetime(2000, 1, 1, hour).strftime("%p") for hour in (0, 12)],
            }
            spellings = {
                **_FIXED_WIDTH,
                **{
                    directive: re.escape(parsed.strftime(directive))
                    for directive in ("%c", "%x", "%X")
                },
                **{
                    directive: "(?:" + "|".join(map(re.escape, values)) + ")"
                    for directive, values in names.items()
                },
            }
            pattern = "".join(
                spellings.get(
                    part,
                    "%"
                    if part == "%%"
                    else ".+"
                    if part.startswith("%")
                    else re.escape(part),
                )
                for part in re.split(r"(%.)", python_date_format)
            )
            if not re.fullmatch(pattern, text):
                raise ValueError("Date does not match its stored spelling")
        except ValueError:
            return (
                f"{candidate!r} does not match the column's stored date "
                f"format {python_date_format!r}. Use that format for this column."
            )
        return None
    if text.lstrip("+-").isdigit():
        return (
            f"{candidate!r} is ambiguous: an all-digit string would be read "
            "as epoch milliseconds, not as a year. Write a year as "
            "'YYYY-01-01', or pass epoch milliseconds as a number."
        )
    try:
        if not _SQL_ISO_DATE.fullmatch(text):
            raise ValueError("Unsupported SQL date syntax")
        datetime.fromisoformat(text)
    except ValueError:
        return f"{candidate!r} is not an ISO 8601 date. {_ACCEPTED_FORMATS}"
    return None
