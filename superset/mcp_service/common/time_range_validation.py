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

"""
Shared ``time_range`` validation for MCP tools that forward a free-form,
model-generated string into a ``TEMPORAL_RANGE`` filter or a native filter's
``default_time_range``.

``superset.utils.date_parser.get_since_until()`` only rewrites a
separator-less ``time_range`` into a bounded range when it recognizes one of
a handful of prefixes (``Last``, ``Next``, ``previous calendar ...``,
``Current ...``, ``first ... of ...``). Anything else -- ``banana``,
``this month``, lowercase ``last week``, ``[decade]`` -- silently falls
through to an unbounded ``(None, today)`` result: no error, no warning, and
the query returns the entire table.

That silent behavior is unfixable at the ``get_since_until()`` level without
risking regressions across the whole chart/dashboard query path (see
``jinja_context.py`` and ``semantic_layers/mapper.py``, which also call it).
The MCP tools are the surface that accepts free-form, model-generated
strings, so the guard lives here instead: reject anything
``get_since_until()`` would silently discard, with a message that lists the
accepted forms so the caller (an LLM) can self-correct.
"""

from __future__ import annotations

import re

from superset.constants import NO_TIME_RANGE

# Bracket shorthands (e.g. "[year]", "[quarter]") are not a Superset
# time-range grammar -- they appear when an LLM copies a grain token from a
# dashboard filter context. Map them to an equivalent form that
# get_since_until() resolves correctly.
#
# "Last second"/"Last minute"/"Last hour" are excluded: get_since_until()
# pairs a "Last <unit>" since-expression (resolved against "now" for
# sub-day units) with a default until-expression resolved against "today"
# (midnight), so since ends up after until and raises "From date cannot
# be larger than to date". Explicit DATEADD/DATETIME expressions sidestep
# that mismatch by resolving both ends against "now".
BRACKET_SHORTHAND_TO_TIME_RANGE: dict[str, str] = {
    "[second]": "DATEADD(DATETIME('now'), -1, SECOND) : DATETIME('now')",
    "[minute]": "DATEADD(DATETIME('now'), -1, MINUTE) : DATETIME('now')",
    "[hour]": "DATEADD(DATETIME('now'), -1, HOUR) : DATETIME('now')",
    "[day]": "Last day",
    "[week]": "Last week",
    "[month]": "Last month",
    "[quarter]": "Last quarter",
    "[year]": "Last year",
}

_SEPARATOR = " : "

# Mirrors the exact `startswith` prefixes get_since_until() checks (in
# that order) before it will rewrite a separator-less time_range into a
# " : "-bounded range. Case-sensitive to match get_since_until() exactly --
# e.g. "Last week" parses, "last week" does not.
_PREVIOUS_CALENDAR_PREFIXES = (
    "previous calendar week",
    "previous calendar month",
    "previous calendar quarter",
    "previous calendar year",
)
_CURRENT_PREFIXES = (
    "Current day",
    "Current week",
    "Current month",
    "Current quarter",
    "Current year",
)

# Mirrors date_parser.get_since_until()'s nth_subunit_pattern, the one
# separator-less grammar handled by a regex rather than a literal prefix
# (e.g. "first week of this year"). Kept byte-for-byte in sync with that
# pattern; the existing date_parser test suite is the guard against drift.
_NTH_SUBUNIT_PATTERN = re.compile(
    r"^(first|1st)\s{1,5}"
    r"(week|month|quarter)\s{1,5}of\s{1,5}"
    r"(?:(this|last|next|prior)\s{1,5})?"
    r"(?:the\s{1,5})?"
    r"(week|month|quarter|year)$",
    re.IGNORECASE,
)


def _has_recognized_bare_prefix(value: str) -> bool:
    """Whether get_since_until() rewrites this separator-less value into a
    bounded range, rather than silently discarding it."""
    if value.startswith("Last") or value.startswith("Next"):
        return True
    if value.startswith(_PREVIOUS_CALENDAR_PREFIXES):
        return True
    if value.startswith(_CURRENT_PREFIXES):
        return True
    return bool(_NTH_SUBUNIT_PATTERN.match(value))


def validate_time_range(value: str | None) -> str | None:
    """Normalize and validate an MCP ``time_range`` / ``default_time_range``
    string.

    Returns the canonicalized value. Raises ``ValueError`` -- which Pydantic
    converts into a field ``ValidationError`` -- when ``value`` is a bare
    (non-range) string that ``get_since_until()`` cannot resolve to a
    bounded range. Such values previously passed straight through and
    silently produced an unfiltered, full-table match.
    """
    if value is None:
        return None

    stripped = value.strip()
    # An empty string is the "no default" / "no filter applied" sentinel
    # for these tools (callers gate on truthiness before using it), not a
    # value get_since_until() ever sees -- pass it through unchanged.
    if not stripped:
        return stripped

    if stripped == NO_TIME_RANGE:
        return stripped

    if (canonical := BRACKET_SHORTHAND_TO_TIME_RANGE.get(stripped.lower())) is not None:
        return canonical

    if _SEPARATOR in stripped:
        return stripped

    if _has_recognized_bare_prefix(stripped):
        return stripped

    raise ValueError(
        f"Unrecognized time_range value: {value!r}. A bare (non-range) "
        "time_range must be one of: 'Last <unit>' (e.g. 'Last 7 days', "
        "'Last month', 'Last year'), 'Next <unit>', 'previous calendar "
        "<week|month|quarter|year>', 'Current <day|week|month|quarter|"
        "year>', 'first <week|month|quarter> of [this|last|next|prior] "
        "<week|month|quarter|year>', or a bracket shorthand like "
        f"{sorted(BRACKET_SHORTHAND_TO_TIME_RANGE)}. For anything else, "
        "use an explicit '<start> : <end>' range, e.g. "
        "'2024-01-01 : 2024-12-31'."
    )
