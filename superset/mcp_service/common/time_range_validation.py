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

"""Normalize MCP time ranges and expose shared parser validation as field errors.

The shared parser rejects malformed separator-less ranges. MCP additionally
accepts bracket shorthands and empty defaults, and provides accepted-format
guidance when parser validation fails.
"""

from __future__ import annotations

import re

from superset.commands.chart.exceptions import (
    TimeRangeAmbiguousError,
    TimeRangeParseFailError,
)
from superset.constants import NO_TIME_RANGE
from superset.utils.date_parser import get_since_until

# Bracket shorthands (e.g. "[year]", "[quarter]") are not a Superset
# time-range grammar -- they appear when an LLM copies a grain token from a
# dashboard filter context. Map them to the equivalent "Last <unit>" form;
# the sub-day ones are rewritten further by _normalize_sub_day_last() below,
# so "[hour]" and a bare "Last hour" converge on one canonical range.
BRACKET_SHORTHAND_TO_TIME_RANGE: dict[str, str] = {
    "[second]": "Last second",
    "[minute]": "Last minute",
    "[hour]": "Last hour",
    "[day]": "Last day",
    "[week]": "Last week",
    "[month]": "Last month",
    "[quarter]": "Last quarter",
    "[year]": "Last year",
}

_SEPARATOR = " : "

_LAST_PREFIX = "Last "

# The sub-day tail of a "Last ..." expression, e.g. the "5 minutes" in
# "Last 5 minutes". Unit case is ignored to match get_since_until()'s own
# case-insensitive handling of it.
# "Next <second|minute|hour>" needs no equivalent treatment: get_since_until()
# anchors its since bound on "now" (the same as the "Last" side), so
# since <= until always holds.
_SUB_DAY_REMAINDER = re.compile(
    r"^(?:(\d{1,9})\s{1,5})?(second|minute|hour)s?$", re.IGNORECASE
)


def _normalize_sub_day_last(value: str) -> str | None:
    """Rewrite a sub-day ``Last ...`` value into an explicit ``DATEADD`` range.

    ``get_since_until()`` itself now resolves a sub-day ``Last ...`` value
    directly -- it used to turn a separator-less ``"Last hour"`` into
    ``"Last hour : today"``, where the since side resolved against ``now``
    while ``today`` resolved to midnight, so since landed after until and the
    call raised "From date cannot be larger than to date". This rewrite
    predates that fix and is kept anyway: it guarantees callers always get
    the same explicit, anchor-independent ``DATEADD`` form for a sub-day
    ``Last``, rather than depending on however ``get_since_until()`` happens
    to pick its default bound today.

    Returns ``None`` when ``value`` is not a sub-day ``Last`` expression, in
    which case the caller falls back to ``_is_valid_shorthand()``.
    """
    if not value.startswith(_LAST_PREFIX):
        return None
    match = _SUB_DAY_REMAINDER.match(value[len(_LAST_PREFIX) :].strip())
    if match is None:
        return None
    quantity = int(match.group(1) or 1)
    unit = match.group(2).upper()
    return f"DATEADD(DATETIME('now'), -{quantity}, {unit}) : DATETIME('now')"


def _is_valid_shorthand(value: str) -> bool:
    """Delegate shorthand acceptance to the shared parser without copying grammar."""
    try:
        get_since_until(time_range=value)
    except (ValueError, TimeRangeParseFailError, TimeRangeAmbiguousError):
        return False
    return True


def validate_time_range(value: str | None, *, allow_empty: bool = True) -> str | None:
    """Normalize and validate an MCP ``time_range`` / ``default_time_range``
    string. Filter comparators must set ``allow_empty=False`` because their
    values are passed directly to the parser rather than used as defaults.

    Returns the canonicalized value. Raises ``ValueError`` -- which Pydantic
    converts into a field ``ValidationError`` -- when ``value`` is a bare
    (non-range) string that ``get_since_until()`` cannot resolve to a
    bounded range. Such values previously passed straight through and
    silently produced an unfiltered, full-table match.
    """
    if value is None:
        return None

    stripped = value.strip()
    # Optional top-level ranges use an empty default; filter comparators do not.
    if not stripped:
        if not allow_empty:
            raise ValueError(
                "TEMPORAL_RANGE requires a non-empty range. Use 'No filter', "
                "a supported shorthand such as 'Last week', or '<start> : <end>'."
            )
        return stripped

    if stripped == NO_TIME_RANGE:
        return stripped

    if (canonical := BRACKET_SHORTHAND_TO_TIME_RANGE.get(stripped.lower())) is not None:
        stripped = canonical

    if (rewritten := _normalize_sub_day_last(stripped)) is not None:
        return rewritten

    # A value carrying the separator is already an explicit "<start> : <end>"
    # range, so it can't hit the silent unbounded fallback. Any parse failure
    # in either half raises loudly downstream, which is a signal the caller
    # can act on -- leave those to the parser rather than second-guessing
    # them here, where the relative anchors may differ from the query's.
    if _SEPARATOR in stripped:
        return stripped

    if _is_valid_shorthand(stripped):
        return stripped

    raise ValueError(
        f"Unrecognized time_range value: {value!r}. A bare (non-range) "
        "time_range must be one of: 'Last <unit>' (e.g. 'Last 7 days', "
        "'Last month', 'Last year', 'Last hour', 'Last 5 minutes'), "
        "'Next <unit>', 'previous calendar "
        "<week|month|quarter|year>', 'Current <day|week|month|quarter|"
        "year>', 'first <week|month|quarter> of [this|last|next|prior] "
        "<week|month|quarter|year>', or a bracket shorthand like "
        f"{sorted(BRACKET_SHORTHAND_TO_TIME_RANGE)}. For anything else, "
        "use an explicit '<start> : <end>' range, e.g. "
        "'2024-01-01 : 2024-12-31'."
    )
