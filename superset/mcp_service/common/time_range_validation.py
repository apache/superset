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

Acceptance is decided by *calling* ``get_since_until()`` and checking what
comes back, not by re-implementing its grammar here. Mirroring the grammar
would drift from the real parser and force a choice between rejecting valid
freeform values (``Last Monday``, ``Last year to date``) and admitting
malformed ones (``Last nonsense``, a bare ``Last``). Delegating gets both
right by construction.
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
# "Last 5 minutes". Unit case is ignored because the downstream parser is
# case-insensitive about it ("Last Hour" fails exactly like "Last hour").
# "Next <second|minute|hour>" needs no equivalent treatment:
# get_since_until() pairs it with a "today" (midnight) *since*, so
# since <= until always holds.
_SUB_DAY_REMAINDER = re.compile(
    r"^(?:(\d{1,9})\s{1,5})?(second|minute|hour)s?$", re.IGNORECASE
)


def _normalize_sub_day_last(value: str) -> str | None:
    """Rewrite a sub-day ``Last ...`` value into an explicit ``DATEADD`` range.

    ``get_since_until()`` turns a separator-less ``"Last hour"`` into
    ``"Last hour : today"``. The since side then resolves against ``now``
    (sub-day units carry a time component) while ``today`` resolves to
    midnight, so since lands after until and the call raises "From date
    cannot be larger than to date". This affects every sub-day form --
    ``Last second``, ``Last minute``, ``Last hour``, ``Last 5 minutes``,
    ``Last 2 hours``. Anchoring both ends on ``now`` sidesteps the mismatch.

    Returns ``None`` when ``value`` is not a sub-day ``Last`` expression, in
    which case the caller falls back to ``_resolves_to_bounded_range()``.
    """
    if not value.startswith(_LAST_PREFIX):
        return None
    match = _SUB_DAY_REMAINDER.match(value[len(_LAST_PREFIX) :].strip())
    if match is None:
        return None
    quantity = int(match.group(1) or 1)
    unit = match.group(2).upper()
    return f"DATEADD(DATETIME('now'), -{quantity}, {unit}) : DATETIME('now')"


def _resolves_to_bounded_range(value: str) -> bool:
    """Whether get_since_until() turns this separator-less value into a
    range bounded on both ends.

    Asks the real parser instead of re-implementing its grammar, which is
    what makes the accept/reject split exact:

    * ``Last 7 days``, ``Current week``, ``previous calendar year``,
      ``first week of this year`` -- and freeform tails the parser handles
      on its own, like ``Last Monday``, ``Last January``,
      ``Last year to date`` -- all resolve, so they're accepted.
    * ``banana``, ``this month``, lowercase ``last week`` resolve to an
      unbounded ``(None, today)``: the silent full-table match this module
      exists to catch.
    * ``Last nonsense``, ``Last decade`` and a bare ``Last`` raise inside
      the parser. Rejecting them here turns what would surface as a
      low-level parse error deep in the query path into a field-level
      ``ValidationError`` carrying the accepted-format guidance.

    Sub-day ``Last`` values must be rewritten by ``_normalize_sub_day_last()``
    before reaching this check -- they raise here, but the fix is to
    normalize them, not to reject them.
    """
    try:
        since, until = get_since_until(time_range=value)
    except (ValueError, TimeRangeParseFailError, TimeRangeAmbiguousError):
        return False
    return since is not None and until is not None


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

    if _resolves_to_bounded_range(stripped):
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
