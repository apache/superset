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
Partition filter mapping.

Datasets on Hadoop-family engines are commonly partitioned on a *technical*
column -- an epoch integer, a lowercased region key -- that no analyst would
filter on. Unless a query carries a predicate on that column the engine scans
every partition.

A dataset owner names one partition column ``p``, one business column that
filters are mirrored from, and a value transform ``T`` (a SQL expression
containing a ``:value`` placeholder). Superset then appends an equivalent
predicate on ``p`` to every query, so chart authors change nothing and queries
prune.

The load-bearing assumption
---------------------------
Everything here reasons about ``T(col) op T(v)``, but what is emitted is
``p op T(v)`` -- a predicate on a *physically different column*. The step from
one to the other is::

    p = T(mapped_col)   for every row in the table

Superset cannot verify that; it is a property of whatever ETL populates the
partition column. If that job lags, backfills with different logic, or writes
the partition key in a different timezone, mirrored predicates silently drop
real rows. The mapping is only as trustworthy as the pipeline behind it.

Operator safety
---------------
A mirrored predicate ``P2`` may only be ``AND``-ed onto a query when the
original predicate ``P1`` *implies* it:

===========================================  =============================
Original                                     Safe when
===========================================  =============================
``col = v``, ``col IN (...)``                ``T`` is a function *and* the
                                             engine compares ``col``
                                             byte-exactly
``col >=|>|<|<= v``, ``TEMPORAL_RANGE``      only if ``T`` is monotonic
``col != v``, ``NOT IN``, ``LIKE``, ...      never
===========================================  =============================

Monotonic here means non-decreasing, not strictly increasing: a bucketing
transform such as a day key is monotonic and maps a whole day of timestamps
onto one value. ``col < v`` then only implies ``T(col) <= T(v)``, so a strict
bound is mirrored non-strictly -- see `mirror_operator`.

Equality under the engine's own rules
-------------------------------------
"``T`` is a function" gives ``col = v`` implies ``T(col) = T(v)`` for *value*
equality. The engine compares with *SQL* equality, and the two part company
wherever that comparison is not byte-exact: under a case-insensitive collation
a stored ``country`` of ``'us'`` satisfies a filter for ``'US'``, while the
mirror ``region_key = hex('US')`` excludes the row and the chart loses it with
nothing to indicate why. Trailing-space-insensitive ``CHAR`` comparison says
the same thing about padding.

So equality and ``IN`` are withdrawn for a *string* mapped column unless the
engine spec declares ``binary_string_comparison`` -- `equality_mirrors_safely`.
Numeric and temporal comparison is exact everywhere and is untouched, and range
mirroring is untouched too: it already rests on the owner declaring ``T``
order-preserving *with respect to the column's own order*, which is an
assertion about the very semantics this is checking for.

What the gate cannot see is a column declaring its own collation
(``country COLLATE NOCASE``) on an otherwise byte-exact engine. Nothing in
SQLAlchemy's reflection or the engine specs exposes that, so there it remains
the owner's assumption, like ``p = T(mapped_col)`` itself.

Resolution of the value the engine compares
-------------------------------------------
Every row of the table above assumes the engine compares the value the mirror
was built from. It does not always. A ``DATE`` column compared against
``'2026-07-06 10:08:11'`` is compared on the date part alone -- whether the
engine writes the literal itself (``TO_DATE('2026-07-06', 'YYYY-MM-DD')`` on
Postgres, ``DATE '2026-07-06'`` on Presto, Trino, BigQuery and some two dozen
others) or applies an implicit cast to a bound string. The filter therefore
keeps the whole of that day while ``p = T(2026-07-06 10:08:11)`` keeps one
instant of it: narrower than the predicate it stands in for, which is the one
thing a mirror may never be.

What an engine throws away is detected from the column's type rather than
enumerated per engine -- `ExploreMixin._engine_literal_resolution` -- and what
to do about it is a property of the *operator*, not of the value:

* a bound rounds outward, backward for a lower one and forward for an upper one,
  through `ExploreMixin._round_bounds_outward`. The mirror then reads one extra
  bucket at the edge, and the original predicate is still in the query to
  exclude the rows that bucket adds.
* an equality, or one member of an ``IN`` list, has nowhere to widen to: these
  predicates are ``AND``-ed onto the query, so "or the day either side" is not
  something the mirror can express. They decline, which costs the query its
  pruning and nothing else.

So a ``DATE``-typed mapped column mirrors a range at day granularity, and does
not mirror an equality whose value carries a time of day at all. Map a
``TIMESTAMP`` column instead and every operator is available again.

Negations are never safe because ``T`` need not be injective:
``lower(:value)`` with ``country != 'US'`` mirrors to ``region_key != 'us'``,
which wrongly excludes rows whose ``country`` is already lowercase ``'us'`` --
rows the original filter *keeps*.

Monotonicity is a property of the transform, not of the column's data type:
``hour(:value)``, ``date_format(:value, 'dd')`` and ``dayofweek(:value)`` are
all reasonable transforms on a ``TIMESTAMP`` column and none of them preserve
ordering. It is therefore declared by the owner, not inferred.

Time grains
-----------
A grained filter -- drill-to-detail, mostly -- compares the *truncated* column,
``trunc(col) op v``, so the raw bounds it carries do not describe the rows it
keeps. A row in the final partial bucket satisfies ``trunc(col) < until`` while
``col < until`` excludes it.

Which direction a grain rounds is not knowable from the duration alone, and the
obvious guess is wrong: ``WEEK_ENDING_SATURDAY`` rounds *forward* on Hive and
Presto, and Ocient's grains are ``ROUND``, i.e. to nearest. What every grain
does satisfy is a bound on the displacement::

    |trunc(ts) - ts| < width(grain)

so widening *both* bounds by one bucket width is no narrower than the real
predicate whichever way the grain rounds -- and it needs no monotonicity of
``trunc`` itself, which is what rescues Hive's oddly-anchored ``P1W``. Width is
a property of the grain, not of the engine, which is what makes this
maintainable; see `grain_bucket_width`. A grain whose SQL an operator supplied
has no known width, and does not mirror at all.
"""

from __future__ import annotations

import hashlib
import logging
import numbers
import re
from collections.abc import Sequence
from dataclasses import dataclass
from datetime import date, datetime
from functools import lru_cache
from typing import Any, cast, TYPE_CHECKING

import numpy as np
import pandas as pd
import sqlalchemy as sa
from dateutil.relativedelta import relativedelta
from flask import current_app as app
from flask_babel import lazy_gettext as _
from sqlalchemy.engine.interfaces import Dialect
from sqlalchemy.sql.elements import ColumnElement

from superset.constants import LRU_CACHE_MAX_SIZE, TimeGrain
from superset.exceptions import (
    QueryClauseValidationException,
    SupersetParseError,
    SupersetSecurityException,
)
from superset.extensions import cache_manager, feature_flag_manager
from superset.sql.parse import SQLScript, SQLStatement
from superset.superset_typing import FilterValues
from superset.utils import core as utils, json
from superset.utils.core import FilterOperator

if TYPE_CHECKING:
    from superset.connectors.sqla.models import SqlaTable, TableColumn
    from superset.db_engine_specs.base import BaseEngineSpec
    from superset.models.core import Database

logger = logging.getLogger(__name__)

FEATURE_FLAG = "PARTITION_FILTER_MAPPING"

#: Longest transform accepted anywhere. A transform is one SQL expression an
#: owner types by hand, so this is generous; the point is that it is bounded.
#: The bound matters because `is_transform_active` parses the stored value on
#: each Explore load, and an unbounded string would make that parse the
#: expensive part of rendering a chart.
#:
#: The typed column field, the import schema and the preview request each
#: enforce it through a marshmallow `Length` validator, which is what produces
#: the per-field message those three callers want. `stored_expression_error`
#: enforces it too, for the paths that load no schema -- the deprecated
#: `POST /datasource/save/` is one, and it writes straight through
#: `update_from_object`.
MAX_TRANSFORM_LENGTH = 1024

#: Placeholder the owner writes in the transform, e.g. ``unix_timestamp(:value)``.
#: Matched with word boundaries so ``:values`` is not mistaken for it.
VALUE_PLACEHOLDER_RE = re.compile(r":value\b")

#: Balanced Jinja blocks. The probe would render these in a different context
#: at a different time from the chart query, so they are rejected at save time.
JINJA_BLOCK_RE = re.compile(r"\{\{.*?\}\}|\{%.*?%\}|\{#.*?#\}", re.DOTALL)

#: Substituted for ``:value`` before parsing -- sqlglot rejects a bare ``:value``
#: on most dialects. Mirrors the ``_JINJA_BLOCK_RE`` -> ``NULL`` trick used by
#: ``validate_stored_expression``.
_PARSE_STANDIN = "NULL"

#: Substituted for ``:value`` to find out *where* the placeholder landed, which
#: `_PARSE_STANDIN` cannot answer: ``NULL`` is a keyword, so after substitution
#: the parse tree no longer records that a placeholder was ever there. An
#: identifier does leave a trace -- a column reference -- and one that is
#: missing is a placeholder the engine will never evaluate.
#:
#: Named so it cannot plausibly collide with a real column, but a transform that
#: writes it anyway is refused rather than counted. A hand-written occurrence
#: does not merely make the count disagree: it *supplies* the column reference a
#: non-executable placeholder failed to produce, and the two cancel exactly. See
#: `placeholder_is_executable`.
_PLACEHOLDER_STANDIN = "superset_pfm_value_standin"

#: Functions whose value depends on wall-clock time or randomness. The probe
#: runs in a different session at a different moment from the chart query and
#: its result is then cached, so any of these freezes a snapshot of probe time
#: into the emitted predicate.
NON_DETERMINISTIC_FUNCTIONS = {
    "CURRENT_DATE",
    "CURRENT_TIME",
    "CURRENT_TIMESTAMP",
    "NOW",
    "RAND",
    "RANDOM",
    "UUID",
}

#: Functions that mean "now" only in their zero-argument form. On Hive and
#: Impala ``unix_timestamp()`` is the current time while ``unix_timestamp(x)``
#: -- the canonical transform for this feature -- is pure.
NON_DETERMINISTIC_WHEN_NILADIC = {"UNIX_TIMESTAMP"}

#: Safe for any function ``T``.
MIRRORABLE_ALWAYS = {FilterOperator.EQUALS, FilterOperator.IN}

#: Safe only when ``T`` preserves ordering.
MIRRORABLE_IF_MONOTONIC = {
    FilterOperator.GREATER_THAN,
    FilterOperator.GREATER_THAN_OR_EQUALS,
    FilterOperator.LESS_THAN,
    FilterOperator.LESS_THAN_OR_EQUALS,
    FilterOperator.TEMPORAL_RANGE,
}


#: Every operator that can be mirrored under *some* transform. The preview
#: endpoint accepts these; whether a given one actually mirrors still depends on
#: the monotonicity declaration.
MIRRORABLE_OPERATORS = MIRRORABLE_ALWAYS | MIRRORABLE_IF_MONOTONIC

#: Operators the preview endpoint can construct. `TEMPORAL_RANGE` is mirrored by
#: the query path, but as *two* bounds that `_collect_partition_mirror_range`
#: decomposes a time range into -- the preview request carries sample values, not
#: a since/until pair, so there is no range for it to build. The editor never
#: asks for one either: `previewOperatorFor` sends `>=`, `=` or `IN`.
PREVIEWABLE_OPERATORS = MIRRORABLE_OPERATORS - {FilterOperator.TEMPORAL_RANGE}


#: A transform that preserves ordering need not be *strictly* increasing: a day
#: key such as ``to_char(ts, 'YYYYMMDD')`` maps a whole day of timestamps onto
#: one value. For such a ``T``, ``col < v`` only implies ``T(col) <= T(v)`` and
#: ``col > v`` only implies ``T(col) >= T(v)`` -- the rows in the bucket at the
#: boundary satisfy the non-strict form and not the strict one. A strict mirror
#: therefore drops rows the filter keeps, which is the one thing a mirror may
#: never do, so a strict bound is mirrored non-strictly.
_NON_STRICT_EQUIVALENT = {
    FilterOperator.GREATER_THAN: FilterOperator.GREATER_THAN_OR_EQUALS,
    FilterOperator.LESS_THAN: FilterOperator.LESS_THAN_OR_EQUALS,
}


def mirror_operator(operator: FilterOperator) -> FilterOperator:
    """
    The operator a mirrored predicate uses to stand in for ``operator``.

    Strict bounds widen; everything else passes through. Idempotent, so it is
    safe wherever a request may already have been widened.

    The widened bound reads one extra partition at the edge, and the original
    predicate is still in the query to exclude the rows that partition adds --
    the same trade as the grain widening and the ``NULL``-partition escape.
    Declaring the transform strictly increasing would buy that partition back,
    which is not worth a second property only the owner can vouch for.
    """
    return _NON_STRICT_EQUIVALENT.get(operator, operator)


def mirrorable_operators(
    is_monotonic: bool, *, equality_is_safe: bool = True
) -> set[FilterOperator]:
    """
    The operators whose predicates may be mirrored onto the partition column.

    :param is_monotonic: whether the owner declared the transform
        order-preserving
    :param equality_is_safe: whether the engine's ``=`` on the mapped column
        compares the way ``T`` was written against -- see
        `equality_mirrors_safely`

    Both call sites -- the query path through `PartitionMapping.mirrors` and the
    Explore indicator through `partition_filter_mapping_summary` -- come through
    here, which is what keeps the glyph from promising pruning the SQL will not
    do.
    """
    operators = MIRRORABLE_ALWAYS if equality_is_safe else set()
    if is_monotonic:
        operators = operators | MIRRORABLE_IF_MONOTONIC
    return set(operators)


def equality_mirrors_safely(
    column: TableColumn | None,
    db_engine_spec: type[BaseEngineSpec],
) -> bool:
    """
    Whether ``col = v`` on this column implies ``T(col) = T(v)`` in the engine.

    The operator matrix calls equality safe "for any function ``T``" because
    ``T`` is a function, so ``col = v`` gives ``T(col) = T(v)``. That reasons
    about *value* equality while the engine reasons about *SQL* equality, and
    the two part company under any comparison that is not byte-exact: with a
    case-insensitive collation a stored ``country`` of ``'us'`` satisfies a
    filter for ``'US'``, but the mirror ``region_key = hex('US')`` excludes the
    row and the chart loses it with no indication why. Trailing-space-insensitive
    ``CHAR`` comparison says the same thing about padding.

    Only string columns are at risk; numeric and temporal comparison is exact
    everywhere. And only equality: range mirroring already requires the owner
    to declare ``T`` order-preserving *with respect to the column's own order*,
    which is an assertion about the same comparison semantics this is checking
    for -- so the declaration covers it where equality has nothing to cover it.

    What this cannot see is a column that declares its own collation
    (``country COLLATE NOCASE``) on an otherwise byte-exact engine. Neither
    SQLAlchemy's reflection nor the engine specs expose it, so on such a column
    the assumption stays where ``p = T(mapped_col)`` already is: with the owner.
    """
    if column is None:
        return True
    try:
        is_string = column.type_generic == utils.GenericDataType.STRING
    except Exception:  # pylint: disable=broad-except  # noqa: BLE001
        # An unresolvable type is treated as a string: the gate exists to stop
        # a silent wrong answer, so it fails closed.
        return False
    if not is_string:
        return True
    return bool(db_engine_spec.binary_string_comparison)


#: How wide one bucket of each built-in time grain is.
#:
#: Keyed on the ISO duration a filter carries in its ``grain``. Written out
#: rather than parsed: four of the week grains are ISO *intervals* with an
#: anchor (``P1W/1970-01-03T00:00:00Z``) that ``isodate.parse_duration``
#: rejects outright, and ``PT0.5H`` / ``P0.25Y`` are fractional. A literal
#: table is also the thing a reviewer can check a line at a time.
#:
#: ``relativedelta`` rather than ``timedelta`` so the calendar grains stay
#: calendar arithmetic: a month is not 30 days.
GRAIN_BUCKET_WIDTHS: dict[str, relativedelta] = {
    TimeGrain.SECOND: relativedelta(seconds=1),
    TimeGrain.FIVE_SECONDS: relativedelta(seconds=5),
    TimeGrain.THIRTY_SECONDS: relativedelta(seconds=30),
    TimeGrain.MINUTE: relativedelta(minutes=1),
    TimeGrain.FIVE_MINUTES: relativedelta(minutes=5),
    TimeGrain.TEN_MINUTES: relativedelta(minutes=10),
    TimeGrain.FIFTEEN_MINUTES: relativedelta(minutes=15),
    TimeGrain.THIRTY_MINUTES: relativedelta(minutes=30),
    TimeGrain.HALF_HOUR: relativedelta(minutes=30),
    TimeGrain.HOUR: relativedelta(hours=1),
    TimeGrain.SIX_HOURS: relativedelta(hours=6),
    TimeGrain.DAY: relativedelta(days=1),
    TimeGrain.WEEK: relativedelta(days=7),
    TimeGrain.WEEK_STARTING_SUNDAY: relativedelta(days=7),
    TimeGrain.WEEK_STARTING_MONDAY: relativedelta(days=7),
    TimeGrain.WEEK_ENDING_SATURDAY: relativedelta(days=7),
    TimeGrain.WEEK_ENDING_SUNDAY: relativedelta(days=7),
    TimeGrain.MONTH: relativedelta(months=1),
    TimeGrain.QUARTER: relativedelta(months=3),
    TimeGrain.QUARTER_YEAR: relativedelta(months=3),
    TimeGrain.YEAR: relativedelta(years=1),
}


def grain_bucket_width(grain: str | None, engine: str) -> relativedelta | None:
    """
    How far a grain's truncation can move a timestamp, or ``None`` if unknown.

    A grained filter compares the *truncated* column, so the raw bounds it
    carries do not describe the rows it keeps. Widening both bounds by one
    bucket recovers a predicate that is no narrower than the real one -- see
    `_collect_partition_mirror_range` for the argument. That only works for a
    grain whose bucket width Superset knows, which excludes anything an
    operator supplied.

    :param grain: the ISO duration from the filter's ``grain``
    :param engine: the engine spec's ``engine``, to check per-engine overrides
    """
    if not grain:
        return None

    # An operator-declared grain carries whatever duration string they typed,
    # and `TIME_GRAIN_ADDON_EXPRESSIONS` can redefine a *built-in* grain's SQL
    # per engine -- `P1D` could be anything at all. Neither has a width we can
    # claim to know, so both fall back to not mirroring.
    if grain in app.config["TIME_GRAIN_ADDONS"]:
        return None
    if grain in app.config["TIME_GRAIN_ADDON_EXPRESSIONS"].get(engine, {}):
        return None

    return GRAIN_BUCKET_WIDTHS.get(grain)


@dataclass(frozen=True)
class PartitionMapping:
    """A resolved, usable partition filter mapping."""

    partition_column: str
    mapped_column: str
    value_transform: str
    is_monotonic: bool
    #: Whether the engine compares the mapped column the way ``T`` was written
    #: against. Resolved once where the column and the engine are both in hand,
    #: rather than re-derived at each `mirrors` call.
    equality_is_safe: bool = True

    def mirrors(self, operator: FilterOperator) -> bool:
        return operator in mirrorable_operators(
            self.is_monotonic, equality_is_safe=self.equality_is_safe
        )


def contains_value_placeholder(transform: str | None) -> bool:
    """Whether the transform contains the ``:value`` placeholder."""
    return bool(transform) and VALUE_PLACEHOLDER_RE.search(transform or "") is not None


def contains_jinja(transform: str | None) -> bool:
    """Whether the transform contains a balanced Jinja block."""
    return bool(transform) and JINJA_BLOCK_RE.search(transform or "") is not None


def parse_skeleton(transform: str, standin: str = _PARSE_STANDIN) -> str:
    """
    The transform with ``:value`` substituted out, ready for a SQL parser.

    ``sanitize_clause`` / sqlglot choke on a bare ``:value`` on most dialects,
    so the placeholder is swapped for a benign literal first -- the same trick
    ``validate_stored_expression`` uses for Jinja blocks.

    :param standin: what to substitute. `placeholder_is_executable` passes
        `_PLACEHOLDER_STANDIN` to find out where the placeholder landed.
    """
    # Substituted through a function so `standin` is taken literally. As a
    # replacement *string* `re.sub` would read backslashes in it as escapes,
    # and `build_probe_sql` passes rendered SQL here: a filter value containing
    # `\n` would probe a newline instead of the two characters the predicate
    # compares, and one containing `\1` would raise outright.
    return VALUE_PLACEHOLDER_RE.sub(lambda _: standin, transform)


#: Prefix the transform is wrapped in before parsing. Its length is subtracted
#: from any reported column so positions refer to what the owner actually typed.
_SELECT_PREFIX = "SELECT "


def _parse_skeleton(
    transform: str, engine: str, standin: str = _PARSE_STANDIN
) -> SQLStatement | None:
    """
    Parse ``SELECT <transform>`` with the placeholder substituted out.

    Returns ``None`` when the transform does not parse.
    """
    try:
        return SQLStatement(
            f"{_SELECT_PREFIX}{parse_skeleton(transform, standin)}", engine
        )
    except SupersetParseError:
        return None


def parse_error_detail(transform: str, engine: str) -> str | None:
    """
    Where the parser gave up on the transform.

    Returns ``None`` when it parses, or when the parser offered no position.
    Note that sqlglot parses unknown functions happily -- a misspelled function
    name is not a parse error, it is an engine error, and surfaces only when the
    transform is evaluated.

    The parser's own ``highlight`` is deliberately dropped: it would name the
    ``NULL`` we substituted for ``:value``, which is not a token the owner typed.
    """
    try:
        SQLStatement(f"{_SELECT_PREFIX}{parse_skeleton(transform)}", engine)
    except SupersetParseError as ex:
        column = (ex.error.extra or {}).get("column")
        if not isinstance(column, int):
            return None
        return str(
            _(
                "syntax error at position %(position)d.",
                position=_position_in_transform(transform, column),
            )
        )
    return None


def _position_in_transform(transform: str, parsed_column: int) -> int:
    """
    Map a column in the parsed skeleton back to the transform as typed.

    Two substitutions stand between them: the ``SELECT`` prefix, and every
    ``:value`` that became a shorter ``NULL``. Without unwinding both, a
    reported position drifts left by two characters per placeholder ahead of it
    -- which is worst exactly where transforms usually break, at the end.
    """
    position = max(parsed_column - len(_SELECT_PREFIX), 0)
    shift = len(":value") - len(_PARSE_STANDIN)
    preceding = sum(
        1
        for index, match in enumerate(VALUE_PLACEHOLDER_RE.finditer(transform))
        if match.start() - index * shift < position
    )
    return position + preceding * shift


def placeholder_is_executable(transform: str | None, engine: str) -> bool:
    """
    Whether every ``:value`` sits where the engine will evaluate it.

    `contains_value_placeholder` is a regex over raw text, and `parse_skeleton`
    substitutes before parsing, so neither notices a placeholder that is not in
    an executable position. Two shapes reach the probe that way, and both are
    worse than the inactive mapping a malformed transform earns:

    ``':value'`` -- the placeholder inside a string literal. `build_probe_sql`
    binds it anyway, because SQLAlchemy's own ``text()`` scan is no more
    literal-aware than the regex, and the dialect then renders the bind
    *including its own quotes* in the middle of the owner's quotes. A value of
    ``" || (SELECT secret FROM vault LIMIT 1) || "`` closes the literal and
    compiles to a working sub-query -- the very read primitive
    `stored_expression_error` refuses when it is written openly.

    ``1 -- :value`` -- the placeholder inside a comment. The probe's selections
    are joined on one line, so the comment swallows its own ``AS v0`` alias and
    everything after it; a single-value probe still returns one column, the
    constant is accepted as the transform's result, and the mirror then emits
    ``partition_col = <constant>`` for every filter value. That is wrong rows,
    not lost pruning.

    Answered structurally: substitute an identifier rather than a keyword and
    count the column references it produced. A literal holds no column
    reference and a comment is not parsed at all, so either case comes back
    short of the number of placeholders the owner wrote.

    Which is why a transform naming the stand-in itself is refused outright. The
    count is the whole gate, and a hand-written occurrence pays the difference:
    ``concat(superset_pfm_value_standin, ':value')`` has one placeholder, inside
    a literal that contributes nothing, and one bare reference the owner wrote --
    so the counts match and the gate passes a placeholder the engine will never
    evaluate. The probe then renders the bound value inside the owner's quotes,
    where a value closing the literal can alias a column of any table the
    connection can read into the stand-in's name and have the probe hand it back
    through the preview. There is no legitimate transform naming this identifier,
    so refusing it costs nothing and makes the count mean what it claims.
    """
    if not transform:
        return False
    if _PLACEHOLDER_STANDIN in transform.lower():
        # Lowercased on both sides because `count_bare_column_references` is
        # case-insensitive too: a dialect may normalize an unquoted identifier,
        # so `SUPERSET_PFM_VALUE_STANDIN` would otherwise balance the count
        # while slipping past a case-sensitive check here.
        return False
    expected = len(VALUE_PLACEHOLDER_RE.findall(transform))
    if not expected:
        return False
    statement = _parse_skeleton(transform, engine, _PLACEHOLDER_STANDIN)
    if statement is None:
        return False
    return statement.count_bare_column_references(_PLACEHOLDER_STANDIN) == expected


def is_parseable(transform: str | None, engine: str) -> bool:
    """
    Whether the transform parses as a single select expression.

    "Single" is the load-bearing word. `SELECT lower(:value), 'x'` parses just
    as happily as `SELECT lower(:value)`, but it returns two columns per input
    value, and the probe reads one column per input -- so an `IN` filter would
    get a predicate built from the wrong halves of the wrong rows. Rejecting the
    list here is what lets the probe trust its own column count.
    """
    if not transform or not transform.strip():
        return False
    statement = _parse_skeleton(transform, engine)
    return statement is not None and statement.count_select_expressions() == 1


def is_bare_expression(transform: str | None, engine: str) -> bool:
    """
    Whether the transform is a scalar expression and nothing more.

    `is_parseable` is not enough, because it counts only the projection.
    ``secret || :value FROM vault`` holds exactly one select expression, so it
    parses as "a single expression" -- and `build_probe_sql` then emits
    ``SELECT secret || 'us' AS v0``, where its own alias is read as a table
    alias on the FROM clause the transform smuggled in. The probe reads a
    column the owner was never granted and hands it back through the predicate
    the preview panel renders.

    A transform is a scalar function of ``:value`` by definition -- the whole
    feature rests on ``partition_col = T(mapped_col)``, which only type-checks
    for scalar ``T`` -- so there is no legitimate transform with a clause of
    its own, and none with a sub-query either.
    """
    if not transform or not transform.strip():
        return False
    statement = _parse_skeleton(transform, engine)
    return (
        statement is not None
        and statement.is_bare_select_expression()
        and not statement.has_subquery()
    )


def is_unfinished(transform: str | None, engine: str) -> bool:
    """
    Whether the transform is not SQL yet, as opposed to the wrong SQL.

    The distinction matters because the two deserve opposite treatment. A
    half-typed ``unix_timestamp(:value`` is what a text input produces on the
    way to something valid: a PUT stores it and reports the mapping inactive,
    so discarding it would mean an export could not round-trip the dataset it
    came from. ``unix_timestamp(:value); DROP TABLE t`` is not on the way to
    anything, and has to be refused wherever it is offered.

    Both fail `is_parseable`, and both fail to parse as a single *statement* --
    so neither of those tells them apart. Parsing as a *script* does: the
    multi-statement form is two valid statements, while unfinished text is no
    statement at all.
    """
    if not transform or not transform.strip():
        return False
    try:
        SQLScript(f"{_SELECT_PREFIX}{parse_skeleton(transform)}", engine)
    except SupersetParseError:
        return True
    return False


def find_non_deterministic_functions(transform: str, engine: str) -> set[str]:
    """
    Names of non-deterministic functions the transform calls.

    ``UNIX_TIMESTAMP`` is only reported in its zero-argument form, which means
    "now" on Hive and Impala; the one-argument form is the canonical temporal
    transform and stays allowed.
    """
    statement = _parse_skeleton(transform, engine)
    if statement is None:
        return set()

    found = {
        name
        for name in NON_DETERMINISTIC_FUNCTIONS
        if statement.check_functions_present({name})
    }
    return found | _find_niladic_calls(statement)


def _find_niladic_calls(statement: SQLStatement) -> set[str]:
    """
    Names from ``NON_DETERMINISTIC_WHEN_NILADIC`` called with no arguments.

    Note some dialects resolve the zero-argument form themselves -- Hive parses
    ``unix_timestamp()`` straight to ``CURRENT_TIMESTAMP`` -- in which case the
    name-based check above has already caught it. This is the backstop for the
    dialects that do not.
    """
    return NON_DETERMINISTIC_WHEN_NILADIC & statement.get_niladic_functions()


def resolve_partition_mapping(datasource: SqlaTable) -> PartitionMapping | None:
    """
    Resolve the dataset's mapping, or ``None`` when nothing may be mirrored.

    Every bail-out here is defensive as well as functional: save-time validation
    rejects most of these, but rows predating the validation can still violate
    the invariants, and a column sync can invalidate a mapping that was fine
    when it was written.

    The transform gate is `is_transform_active`, the same function the Explore
    indicator reads, which is `validate_transform` with the messages discarded.
    Anything narrower here would be a second, weaker statement of the same rule:
    a transform calling `now()` that reached storage without passing
    `UpdateDatasetCommand` -- through import, or through a bundle written by hand
    -- would be reported inactive by the editor and still mirrored by this
    function, freezing a snapshot of probe time into the predicate with nothing
    on screen to say so.
    """
    if not feature_flag_manager.is_feature_enabled(FEATURE_FLAG):
        return None

    partition_column = getattr(datasource, "partition_column", None)
    if not partition_column:
        return None

    columns_by_name = {column.column_name: column for column in datasource.columns}
    if partition_column not in columns_by_name:
        # The partition column was dropped by a column sync or at the source.
        return None

    mapped_column_name = (
        getattr(datasource, "partition_mapped_column", None) or datasource.main_dttm_col
    )
    if not mapped_column_name or mapped_column_name not in columns_by_name:
        return None

    if mapped_column_name == partition_column:
        # Self-mapping: the mirrored predicate would duplicate the original.
        return None

    mapped_column = columns_by_name[mapped_column_name]
    transform = getattr(mapped_column, "partition_value_transform", None)
    if not is_transform_active(transform, datasource.database.backend):
        return None

    if has_active_advanced_data_type(mapped_column):
        # `translate_filter` builds its own predicate shape from *translated*
        # values, so the `(operator, value)` pair the operator matrix reasons
        # about does not exist and mirroring would apply the wrong values.
        return None

    return PartitionMapping(
        partition_column=str(partition_column),
        mapped_column=str(mapped_column_name),
        value_transform=cast(str, transform),
        is_monotonic=bool(
            getattr(mapped_column, "partition_transform_is_monotonic", False)
        ),
        equality_is_safe=equality_mirrors_safely(
            mapped_column, datasource.database.db_engine_spec
        ),
    )


def has_active_advanced_data_type(column: TableColumn) -> bool:
    """
    Whether the column's advanced data type is configured and switched on.

    Such a column is never mirrored: ``translate_filter`` builds its own
    predicate shape from translated values, so the ``(operator, value)`` pair
    the operator matrix reasons about does not exist.
    """
    advanced_data_type = getattr(column, "advanced_data_type", None)
    if not advanced_data_type:
        return False
    if not feature_flag_manager.is_feature_enabled("ENABLE_ADVANCED_DATA_TYPES"):
        return False
    return advanced_data_type in app.config.get("ADVANCED_DATA_TYPES", {})


def _denylist_engine_key(database: "Database") -> str:
    """
    The name ``DISALLOWED_SQL_*`` is keyed by for this database.

    The engine spec's own ``engine`` first, because that is what every other
    denylist gate uses (`_raise_for_disallowed_sql`, `sql_lab`) and what an
    operator writing the config reads in the documentation; a spec covering
    several SQLAlchemy backends through ``engine_aliases`` reports the one
    canonical name under which its entry is written.

    Falling back to the URL's backend, because resolving the spec loads the
    SQLAlchemy dialect entrypoint, which imports the driver package. On a
    deployment missing an optional driver that raises rather than merely being
    absent, asking for the spec here would turn a dataset import into a hard
    failure -- and for every engine without aliases the two names are the same
    string anyway.
    """
    try:
        return database.db_engine_spec.engine
    except Exception:  # pylint: disable=broad-except  # noqa: BLE001
        return database.backend


def stored_expression_error(
    database: "Database",
    catalog: str | None,
    schema: str | None,
    transform: str,
) -> str | None:
    """
    Why this transform may not be stored or run, if there is a reason.

    Stricter than the policy a general stored expression goes through, because
    a value transform is a narrower thing: `build_probe_sql` binds only
    `:value` and splices the rest of the transform in as SQL text, which the
    engine then executes, so an ungated transform is arbitrary SQL. A dataset
    editor without SQL Lab could store `(SELECT secret FROM protected_table
    LIMIT 1) || :value`, or `secret || :value FROM protected_table`, and read
    the answer back out of the emitted predicate the preview panel renders.

    So the transform must be a bare scalar expression: no clause of its own and
    no sub-query, whatever `ALLOW_ADHOC_SUBQUERY` says. That is not a
    restriction the feature pays for -- it rests on
    ``partition_col = T(mapped_col)``, which only type-checks for scalar ``T``
    -- and it is what makes the table denylist and the RLS rewrite moot here,
    since neither has a table reference left to govern.

    Returns the engine-agnostic reason as a string rather than raising,
    because its four callers disagree about what to do with it: the preview
    reports it at the field, a PUT and the legacy datasource save refuse the
    write, the importer drops the transform and keeps the dataset, and the
    probe simply declines to run. Raising would make three of those four
    write a `try` around a question.

    Imported inside the function rather than at module scope:
    `connectors.sqla.models` imports this module, so the dependency only runs
    one way at import time.
    """
    from superset.connectors.sqla.models import (  # pylint: disable=import-outside-toplevel,cyclic-import
        validate_stored_expression,
    )

    # Ahead of the parse, both because it is the cheaper question and because
    # the parse is the cost the bound exists to contain.
    if len(transform) > MAX_TRANSFORM_LENGTH:
        return str(
            _(
                "A partition value transform cannot be longer than "
                "%(limit)d characters.",
                limit=MAX_TRANSFORM_LENGTH,
            )
        )

    statement = _parse_skeleton(transform, database.backend)
    if statement is None:
        return str(
            _("A partition value transform must parse as a single SQL expression.")
        )

    # The shape gate again, even though `validate_transform` blocks the same
    # thing at save time. This is the last door before the transform becomes SQL
    # an engine runs, and the only door a row written by an earlier release --
    # or by an importer that ran with the feature flag off -- still passes
    # through.
    if not statement.is_bare_select_expression():
        return str(
            _(
                "A partition value transform must be a single SQL expression, "
                "with no FROM, WHERE or other clause."
            )
        )

    # Unconditionally, not under `ALLOW_ADHOC_SUBQUERY`. A transform is a scalar
    # function of `:value`, so a sub-query in one has no legitimate use, and it
    # is a read primitive whose answer the preview panel renders back to its
    # caller. Refusing it is also what lets this function skip the table
    # denylist and the row-level-security rewrite: with no FROM clause and no
    # sub-query there is no table reference for either to govern.
    if statement.has_subquery():
        return str(_("A partition value transform cannot contain a sub-query."))

    # The shape gates above read the transform with `:value` replaced by the
    # `NULL` keyword, which leaves no trace of where the placeholder was -- so
    # none of them can see a placeholder that is not in an executable position.
    # Checked here as well as in `validate_transform` because this is the door
    # a row written by an earlier release still passes through, and because
    # the escape only completes once a filter value is bound.
    #
    # Guarded on the placeholder being present at all: a transform without one
    # is inert rather than refused (`validate_transform` reports it as Tier 2),
    # and refusing it here would make this gate stricter than the PUT's.
    if contains_value_placeholder(transform) and not placeholder_is_executable(
        transform, database.backend
    ):
        return str(
            _(
                "A partition value transform must use the :value placeholder "
                "where the engine will evaluate it, not inside a string "
                "literal or a comment."
            )
        )

    denied = app.config["DISALLOWED_SQL_FUNCTIONS"].get(
        _denylist_engine_key(database), set()
    )
    if denied and (found := statement.get_disallowed_functions(denied)):
        return str(
            _(
                "A partition value transform cannot call %(functions)s.",
                functions=", ".join(sorted(found)),
            )
        )

    # Kept as the tail call rather than replaced: this is where `sanitize_clause`
    # runs. Its own sub-query branch returns rewritten, RLS-injected SQL that
    # this function has no way to propagate -- but that branch is unreachable
    # from here now, because a transform containing a sub-query was refused
    # above, so discarding the return value is correct rather than a leak.
    try:
        validate_stored_expression(database, catalog, schema, parse_skeleton(transform))
    except SupersetSecurityException as ex:
        return str(ex.error.message)
    except QueryClauseValidationException as ex:
        return str(ex.message)
    return None


@dataclass(frozen=True)
class RawProbeValue:
    """
    A probe value that is already SQL text rather than a bindable scalar.

    Almost every filter value is a Python scalar, which `build_probe_sql` binds
    and lets the dialect render. An array column's value is not: the predicate
    it mirrors compares an engine array literal -- ``array('a', 'b')`` on
    ClickHouse -- which `BaseEngineSpec.array_literal` returns as a SQLAlchemy
    expression, and an expression cannot be the value of a bind parameter.

    Frozen, and holding text rather than the expression, for two reasons
    besides immutability: `_probe_cache_key` keys on ``repr`` of each value, and
    an expression's ``repr`` carries its memory address -- so caching the probe
    would key every call differently. `_hashable` needs it hashable too.

    Build one with `raw_probe_value`, which renders the expression through the
    same literal compilation the bound path uses.
    """

    sql: str


def raw_probe_value(database: "Database", element: Any) -> RawProbeValue:
    """
    Freeze an engine-built expression into probe-ready SQL text.

    The text is produced entirely by SQLAlchemy and the engine spec from values
    that have already been coerced, so no caller-supplied text reaches the probe
    uninspected -- string elements are escaped by the dialect's own literal
    processor. `probe_sql_is_evaluable` then re-reads the finished query, which
    is what bounds the splice.

    :param database: the database whose dialect renders the literal
    :param element: a SQLAlchemy expression, e.g. from ``array_literal``
    :return: the rendered expression, ready to stand in for ``:value``
    """
    return RawProbeValue(_compile_literal(element, _dialect_for(database)))


def normalize_mixed_numbers(values: Sequence[Any]) -> list[Any]:
    """
    One numeric type across ``values``, so a bind cannot be inferred wrongly.

    SQLAlchemy infers an ``IN`` bind's type from the first element it is given.
    A list mixing an int with a float therefore binds as integer and truncates
    every later float: ``[33, 29.02]`` emits ``IN (33, 29)`` and drops the row
    matching ``29.02``.

    Applied on both sides of the probe, which is why it lives here rather than
    inline at either: the filter values collected for mirroring have to match
    the ones the real predicate binds (see #33206), and the probe *results*
    bound against the partition column have the same problem one step later.

    Leaves the list alone when nothing in it is a float, so an exact integer
    key above 2^53 is not rounded for no reason.

    :param values: the values about to be bound
    :return: the values, with every number widened to ``float`` if any was
    """
    if not any(isinstance(value, float) for value in values):
        return list(values)
    return [
        float(value) if isinstance(value, (int, float)) else value for value in values
    ]


def build_probe_sql(
    transform: str,
    values: list[Any],
    dialect: Dialect | None = None,
    from_suffix: str = "",
) -> str:
    """
    Compile a single ``SELECT`` that evaluates the transform at every value.

    Values are attacker-controlled (a Gamma user picks filter values), so they
    are bound as parameters and rendered by the dialect's own literal processor
    rather than interpolated into the SQL text.

    ``from_suffix`` comes from the engine spec's ``select_without_from_suffix``.
    A ``SELECT`` with no ``FROM`` is not universal SQL: Oracle and Db2 need a
    one-row table to select from, and without it every probe on those engines
    raises -- which `_run_probe` swallows, so the only symptom is a correctly
    configured mapping that silently never prunes.

    Note this deliberately does *not* go through ``BaseEngineSpec``'s text
    helper, which escapes ``:`` on every engine but Athena and would destroy the
    ``:value`` placeholder before it can be bound.

    Callers must have run `stored_expression_error` first. The ``AS v{index}``
    alias and ``from_suffix`` are only safe on a transform with no clause of its
    own; on one carrying its own FROM they attach to that instead.
    """
    selections = []
    for index, value in enumerate(values):
        if isinstance(value, RawProbeValue):
            # Already SQL, so substituted rather than bound -- and deliberately
            # not run through `_compile_literal`, which has nothing to compile
            # and would undouble percent signs the owner typed on purpose.
            rendered = parse_skeleton(transform, value.sql)
        else:
            clause = sa.text(transform).bindparams(sa.bindparam("value", value=value))
            rendered = _compile_literal(clause, dialect)
        selections.append(f"{rendered} AS v{index}")
    return "SELECT " + ", ".join(selections) + from_suffix


def probe_sql_is_evaluable(
    sql: str,
    engine: str,
    expected: int,
    from_suffix: str = "",
) -> bool:
    """
    Whether the compiled probe is still the query `build_probe_sql` intended.

    Every write-side gate reads the transform with ``:value`` standing in for a
    value. The escape this guards against only completes once a *real* value is
    rendered in its place, so it is invisible until this point -- and the values
    are supplied by whoever is filtering a chart, not only by the owner who
    wrote the transform.

    Four things have to hold, and all four are about the probe still being
    readable rather than about taste:

    * One statement. A value that closes the expression and starts another
      would otherwise run both.
    * No sub-query. A placeholder inside a string literal lets a value close
      the quote and concatenate one; `stored_expression_error` refuses a
      sub-query written openly, and this refuses the same thing assembled.
    * Exactly ``expected`` projections, aliased ``v0`` upward. A comment
      swallows the rest of its line including its own alias, and the engine
      still answers with a column -- so the count alone does not notice.
      Checking the aliases is what makes a missing one visible.
    * No clause this function did not build, and a ``FROM`` only where
      ``select_without_from_suffix`` asked for one -- the engine's own, not
      merely some table. A rendered value can close the projection and append a
      ``FROM`` of its own without disturbing the aliases that follow it, which
      is a read of a table the mapping has no business reading; the same value
      could append a ``WHERE`` and nothing would notice either.

    Both FROM clauses are compared as sqlglot renders them, so the suffix's own
    spacing does not have to match what the probe emitted. Identifier case does,
    which costs nothing: `_probe` hands the same engine constant to
    `build_probe_sql` and to this gate.
    """
    try:
        script = SQLScript(sql, engine)
    except SupersetParseError:
        return False
    if len(script.statements) != 1:
        return False
    statement = script.statements[0]
    if not isinstance(statement, SQLStatement):
        # A dialect whose statements this gate cannot take apart -- KQL -- gets
        # no probe rather than an unchecked one. It never had one: the clause
        # inspection below is implemented for SQL statements only, and the
        # alternative to declining here is an `AttributeError` that `_probe`
        # swallows into the same outcome, less legibly.
        return False
    if statement.has_subquery():
        return False
    if statement.get_clause_names() - {"from"}:
        return False
    if statement.get_from_clause_sql() != _from_suffix_sql(from_suffix, engine):
        return False
    return statement.get_select_aliases() == [f"v{index}" for index in range(expected)]


def _from_suffix_sql(from_suffix: str, engine: str) -> str | None:
    """
    The engine's own ``FROM`` suffix as its parsed clause, or ``None`` for none.

    Parsed rather than string-compared so that the comparison in
    `probe_sql_is_evaluable` is between two rendered clauses. A suffix that does
    not parse answers ``None``, which no statement carrying a FROM can match --
    the probe then declines, which is the right way for an unreadable engine
    constant to fail.
    """
    if not from_suffix.strip():
        return None
    try:
        return SQLStatement(f"SELECT 1{from_suffix}", engine).get_from_clause_sql()
    except SupersetParseError:
        return None


def evaluate_transform(
    database: Database,
    catalog: str | None,
    schema: str | None,
    transform: str,
    values: list[Any],
    *,
    errors: list[str] | None = None,
) -> list[Any] | None:
    """
    Evaluate ``transform`` against the engine once per distinct value.

    Returns one result per input value, positionally aligned with ``values``, or
    ``None`` if anything at all goes wrong. Failing open costs pruning, never
    correctness: the chart query still runs, it just scans more partitions.

    The probe is pinned to the dataset's catalog and schema so session settings
    match the chart query as closely as the connection pool allows. It still
    runs in a *different* session, which is why transforms calling
    session-dependent functions are rejected at save time.

    :param errors: optional sink for the engine's own account of a failure. The
        query path passes nothing and stays silent; the editor's preview passes
        a list so it can tell the owner *why* the transform did not evaluate --
        a misspelled function is the common case and sqlglot parses it happily.
    """
    if not values:
        return None

    # Dedupe so a 200-value `IN` list costs one column, not 200.
    distinct: list[Any] = []
    seen: set[Any] = set()
    for value in values:
        key = _hashable(value)
        if key not in seen:
            seen.add(key)
            distinct.append(value)

    cache_key = _probe_cache_key(database, catalog, schema, transform, distinct)
    cached = _cache_get(cache_key)
    if cached is None:
        cached = _run_probe(
            database, catalog, schema, transform, distinct, errors=errors
        )
        if cached is None:
            # Deliberately not cached: a transient engine blip would otherwise
            # keep the dataset pruning-free for the whole cache timeout.
            return None
        _cache_set(cache_key, cached)

    evaluated = dict(
        zip((_hashable(value) for value in distinct), cached, strict=False)
    )
    return [evaluated[_hashable(value)] for value in values]


def _run_probe(
    database: Database,
    catalog: str | None,
    schema: str | None,
    transform: str,
    distinct: list[Any],
    *,
    errors: list[str] | None = None,
) -> list[Any] | None:
    """
    `_probe` plus the advisory record of how it went.

    One place rather than one per `return`, because every way out of `_probe`
    is a verdict and the next reader of `known_mirror_verdict` cannot tell the
    difference between "declined" and "never asked".
    """
    values = _probe(database, catalog, schema, transform, distinct, errors=errors)
    record_mirror_verdict(
        database,
        catalog,
        schema,
        transform,
        mirrors=values is not None and not any(value is None for value in values),
    )
    return values


def _probe(
    database: Database,
    catalog: str | None,
    schema: str | None,
    transform: str,
    distinct: list[Any],
    *,
    errors: list[str] | None = None,
) -> list[Any] | None:
    # The last gate before the transform becomes SQL the engine runs, and the
    # only one that covers a transform already in storage. The write-side
    # checks can only speak for rows written after they existed; this speaks
    # for every row, including ones a pre-fix release stored and ones a door
    # that forgets to ask still lets in.
    #
    # Declining costs pruning, never correctness -- see `evaluate_transform`.
    if reason := stored_expression_error(database, catalog, schema, transform):
        logger.warning(
            "Refusing to probe a partition transform that is not a storable "
            "expression; queries will not prune: %s",
            reason,
        )
        return None

    try:
        from_suffix = database.db_engine_spec.select_without_from_suffix
        sql = build_probe_sql(
            transform,
            distinct,
            _dialect_for(database),
            from_suffix,
        )
        if not probe_sql_is_evaluable(
            sql, database.backend, len(distinct), from_suffix
        ):
            # Declining rather than raising, for the same reason every other
            # failure here declines: the chart query is already correct without
            # the mirror, and it is the only thing the caller is waiting on.
            logger.warning(
                "Refusing to run a partition transform probe whose compiled SQL "
                "is not a plain projection per input value; queries will not "
                "prune"
            )
            return None
        frame = database.get_df(sql=sql, catalog=catalog, schema=schema)
        if frame is None or frame.empty:
            logger.warning(
                "Partition transform probe returned no rows; skipping mirroring"
            )
            return None
        column_count = frame.shape[1]
        if column_count != len(distinct):
            # The results cannot be aligned back to their inputs; skipping
            # beats guessing which value produced which column. Too *many*
            # columns is the dangerous direction and the reason this is `!=`
            # rather than `<`: a transform whose select list holds two
            # expressions returns 2N columns for N inputs, and reading the
            # first N of them interleaves the expressions instead of selecting
            # one per value -- a predicate built from the wrong values rather
            # than one that is merely short. `is_parseable` rejects that
            # transform before it is ever stored; this is the backstop for one
            # that predates the check.
            logger.warning(
                "Partition transform probe returned %d values for %d inputs",
                column_count,
                len(distinct),
            )
            return None
        # Cell-wise rather than through `frame.iloc[0]`. A row is a Series, so
        # it carries one dtype for every probe column: a row mixing an exact
        # int64 with a float unifies to float64, and an integer partition key
        # above 2^53 comes back rounded. `_to_python_scalar` converts
        # faithfully but runs after the loss, so the mirror asks for a key the
        # warehouse does not hold and drops the row the filter matched.
        return [
            _to_python_scalar(frame.iat[0, index]) for index in range(len(distinct))
        ]
    except Exception as ex:  # pylint: disable=broad-except
        logger.warning(
            "Partition transform probe failed; queries will not prune",
            exc_info=True,
        )
        if errors is not None:
            errors.append(str(ex))
        return None


def _to_python_scalar(value: Any) -> Any:
    """
    A probed value as a type SQLAlchemy can render and bind.

    The probe reads its results out of a pandas frame, so a numeric column
    arrives as a `numpy.int64` and a temporal one as a `pandas.Timestamp`.
    SQLAlchemy has no literal renderer for either: `sa.literal(np.int64(...))`
    infers `NullType` and raises `CompileError`, which is a 500 from the preview
    endpoint for the canonical epoch transform -- the most ordinary mapping
    there is.

    Pandas' missing-value sentinels are folded into `None` on the way through.
    `NaT` is not a `Timestamp` and has no renderer either, and a transform that
    returns nothing for an input it cannot convert is exactly the NULL case the
    mirror already admits.
    """
    if value is None:
        return None
    try:
        if pd.isna(value):
            return None
    except (TypeError, ValueError):
        # Not something `isna` can judge (a list, a dict); pass it through and
        # let the dialect decide.
        pass
    if isinstance(value, pd.Timestamp):
        return value.to_pydatetime()
    if isinstance(value, np.generic):
        return value.item()
    return value


def _probe_cache_key(
    database: Database,
    catalog: str | None,
    schema: str | None,
    transform: str,
    values: list[Any],
) -> str:
    """
    Key on everything that can change the answer.

    Note this cache is independent of the chart-data cache: it is keyed on the
    transform and its inputs, so it is correct to share across every chart on
    every dataset that happens to use the same transform.
    """
    payload = json.dumps(
        [
            database.id,
            database.backend,
            # The probe asks this connection to evaluate the transform, so the
            # answer belongs to it. `id` outlives an edit to the URI or to
            # `extra` (a session timezone, say), which would otherwise serve
            # values computed against the old environment until the entry
            # expires. `changed_on` covers the edits that do not show up here,
            # such as a rotated password, without putting a secret in the key.
            database.sqlalchemy_uri,
            database.extra,
            str(database.changed_on),
            catalog,
            schema,
            transform,
            [repr(value) for value in values],
        ],
        default=repr,
    )
    digest = hashlib.md5(payload.encode("utf-8")).hexdigest()  # noqa: S324
    return f"partition_transform_probe:{digest}"


def _cache_get(key: str) -> list[Any] | None:
    try:
        return cache_manager.cache.get(key)
    except Exception:  # pylint: disable=broad-except  # noqa: BLE001
        return None


def _cache_set(key: str, value: list[Any]) -> None:
    timeout = app.config.get("PARTITION_TRANSFORM_PROBE_CACHE_TIMEOUT", 24 * 60 * 60)
    try:
        cache_manager.cache.set(key, value, timeout=timeout)
    except Exception:  # pylint: disable=broad-except
        logger.warning("Could not cache partition transform probe", exc_info=True)


def _mirror_verdict_cache_key(
    database: Database,
    catalog: str | None,
    schema: str | None,
    transform: str,
) -> str:
    """
    `_probe_cache_key` without the values.

    Whether a transform can be evaluated at all is a property of the transform
    and the connection, not of the filter that happened to be probing it, so
    one chart's answer settles the question for the next one.
    """
    payload = json.dumps(
        [
            database.id,
            database.backend,
            database.sqlalchemy_uri,
            database.extra,
            str(database.changed_on),
            catalog,
            schema,
            transform,
        ],
        default=repr,
    )
    digest = hashlib.md5(payload.encode("utf-8")).hexdigest()  # noqa: S324
    return f"partition_transform_verdict:{digest}"


def record_mirror_verdict(
    database: Database,
    catalog: str | None,
    schema: str | None,
    transform: str,
    *,
    mirrors: bool,
) -> None:
    """
    Remember whether this transform produced a mirror, for the UI to read.

    Advisory only. Nothing in the query path consults it: a probe that failed
    once is retried on the next chart exactly as it is today, because declining
    to prune for a whole cache timeout over one transient engine blip is the
    trade `evaluate_transform` deliberately refuses -- see the comment where it
    declines to cache a failure.

    What this is for is the *claim*. `is_transform_active` parses the transform
    and no more, so a transform the database rejects -- a misspelled function
    is the common case -- is "active", and the editor's banner and Explore's
    pruning glyph promise a speed-up that never happens. A promise is exactly
    the thing that may be withheld on one bad answer and restored on a good
    one, which is why this is a separate entry from the probe's own results
    rather than a relaxation of that rule.

    Written by `_run_probe`, so the preview endpoint -- which shares the
    evaluator -- settles the question before the owner has even saved.
    """
    timeout = app.config.get("PARTITION_TRANSFORM_PROBE_CACHE_TIMEOUT", 24 * 60 * 60)
    try:
        cache_manager.cache.set(
            _mirror_verdict_cache_key(database, catalog, schema, transform),
            mirrors,
            timeout=timeout,
        )
    except Exception:  # pylint: disable=broad-except
        logger.warning("Could not cache partition transform verdict", exc_info=True)


def known_mirror_verdict(
    database: Database,
    catalog: str | None,
    schema: str | None,
    transform: str,
) -> bool | None:
    """
    The last verdict `record_mirror_verdict` stored, or `None` if there is none.

    `None` is the honest answer on a cold cache and is deliberately not `False`:
    reporting a working mapping as broken until something probes it would
    trade one wrong claim for another. The alternative -- probing from the
    read side -- would put a warehouse round trip on every Explore and
    dashboard load, and a failing transform is not cached at all, so it would
    be a round trip every single time.
    """
    try:
        verdict = cache_manager.cache.get(
            _mirror_verdict_cache_key(database, catalog, schema, transform)
        )
    except Exception:  # pylint: disable=broad-except  # noqa: BLE001
        return None
    return verdict if isinstance(verdict, bool) else None


def _compile_literal(element: Any, dialect: Dialect | None) -> str:
    """
    Compile with inline literals, undoing the paramstyle's percent doubling.

    Both ``TextClause`` and literal compilation run the dialect's
    ``post_process_text``, which doubles every ``%`` whenever the identifier
    preparer asks it to -- true for MySQL and Postgres and for every spec
    inheriting their paramstyle. That doubling exists so a later DBAPI
    parameter-interpolation pass can undo it, and the probe has no such pass:
    it executes with no bound parameters at all. So a transform of
    ``date_format(:value, '%Y%m%d')`` reaches the warehouse asking for the
    literal string ``%%Y%%m%%d``, the probe returns that instead of a date, and
    the mirrored predicate drops every row the filter keeps.

    The same normalization ``Database.compile_sqla_query`` applies for the same
    reason. ``_double_percents`` is private and not guaranteed on a third-party
    dialect, hence the ``getattr`` default.
    """
    compiled = str(
        element.compile(dialect=dialect, compile_kwargs={"literal_binds": True})
    )
    if dialect is not None and getattr(
        dialect.identifier_preparer, "_double_percents", False
    ):
        compiled = compiled.replace("%%", "%")
    return compiled


def _dialect_for(database: Database) -> Dialect | None:
    """
    The dialect used to render literals in the probe SQL.

    Falls back to SQLAlchemy's default dialect if the database cannot produce
    one -- the probe is best-effort and a rendering mismatch surfaces as a
    failed probe, which fails open to no pruning.
    """
    try:
        dialect = database.get_dialect()
    except Exception:  # pylint: disable=broad-except  # noqa: BLE001
        return None
    return dialect if isinstance(dialect, Dialect) else None


def _hashable(value: Any) -> Any:
    """Values arrive from user filters and are not guaranteed hashable."""
    try:
        hash(value)
    except TypeError:
        return repr(value)
    return value


@dataclass(frozen=True)
class MappingValidationIssue:
    """
    One problem found with a mapping at save time.

    ``blocking`` issues reject the save (400). The rest save fine and leave the
    mapping inactive -- the PRD is explicit that a mapping "stays inactive until
    it parses", so a half-written transform must not cost the owner the rest of
    their edits.
    """

    field: str
    message: str
    blocking: bool


def validate_partition_mapping(  # pylint: disable=too-many-arguments
    *,
    column_names: set[str],
    partition_column: str | None,
    partition_mapped_column: str | None,
    main_dttm_col: str | None,
    transform: str | None,
    engine: str,
) -> list[MappingValidationIssue]:
    """
    Validate a dataset's partition mapping, in two tiers.

    Tier 1 (``blocking=True``) is structural and safety: the columns have to
    exist, a column cannot be *asked* to stand in for itself, and the transform
    cannot carry Jinja or call a non-deterministic function. Tier 2
    (``blocking=False``) is everything that merely leaves the mapping inactive
    -- including a self-mapping nobody asked for, where the partition column
    merely happens to be the default datetime column.

    The Tier-1 transform checks need a successful parse to inspect anything, so
    an unparseable transform falls through to Tier 2. That leaves them
    unreachable in exactly the case where it doesn't matter: an unparseable
    transform is never executed.
    """
    if not partition_column:
        return []

    issues: list[MappingValidationIssue] = []

    if partition_column not in column_names:
        issues.append(
            MappingValidationIssue(
                field="partition_column",
                message=_(
                    "Partition column %(name)s is not a column on this dataset.",
                    name=partition_column,
                ),
                blocking=True,
            )
        )

    if partition_mapped_column and partition_mapped_column not in column_names:
        issues.append(
            MappingValidationIssue(
                field="partition_mapped_column",
                message=_(
                    "Mapped column %(name)s is not a column on this dataset.",
                    name=partition_mapped_column,
                ),
                blocking=True,
            )
        )

    if partition_mapped_column and partition_mapped_column == partition_column:
        # Asked for explicitly, so report it as the mistake it is.
        issues.append(
            MappingValidationIssue(
                field="partition_column",
                message=_(
                    "The partition column cannot be mapped onto itself. "
                    "%(name)s is both the partition column and the mapped "
                    "column.",
                    name=partition_column,
                ),
                blocking=True,
            )
        )
    elif not partition_mapped_column and main_dttm_col == partition_column:
        # Resolved onto itself only because the default datetime column happens
        # to be the partition column -- a state metadata sync could produce
        # without anyone asking for it. The mapping is inert either way, since
        # `resolve_partition_mapping` bails out on it, so this reports and lets
        # the write through: blocking here means a dataset already in the state
        # can never be saved again, not even to change its description, and
        # there is no field whose edit would clear the error first.
        issues.append(
            MappingValidationIssue(
                field="partition_mapped_column",
                message=_(
                    "%(name)s is both the partition column and the default "
                    "datetime column, so the mapping points at itself and "
                    "stays inactive. Set a mapped column override, or change "
                    "the default datetime column.",
                    name=partition_column,
                ),
                blocking=False,
            )
        )

    issues.extend(validate_transform(transform, engine))
    return issues


def validate_transform(
    transform: str | None,
    engine: str,
) -> list[MappingValidationIssue]:
    """Validate the value transform on its own. See `validate_partition_mapping`."""
    field = "partition_value_transform"

    if contains_jinja(transform):
        return [
            MappingValidationIssue(
                field=field,
                message=_(
                    "Jinja templating is not supported in a partition value "
                    "transform. The transform is evaluated in a different "
                    "context and at a different time from the chart query, so "
                    "a template would not render the same way."
                ),
                blocking=True,
            )
        ]

    if not transform or not transform.strip():
        return [
            MappingValidationIssue(
                field=field,
                message=_(
                    "No value transform is set, so no filter will be mirrored "
                    "onto the partition column."
                ),
                blocking=False,
            )
        ]

    if not is_parseable(transform, engine):
        detail = parse_error_detail(cast(str, transform), engine)
        return [
            MappingValidationIssue(
                field=field,
                message=(
                    _(
                        "The value transform could not be parsed: %(detail)s "
                        "The mapping is saved but stays inactive until it does.",
                        detail=detail,
                    )
                    if detail
                    else _(
                        "The value transform could not be parsed. The mapping "
                        "is saved but stays inactive until it does."
                    )
                ),
                blocking=False,
            )
        ]

    if not is_bare_expression(transform, engine):
        # Blocking, and deliberately placed in `validate_transform` rather than
        # only at the probe: one issue here closes the PUT, the importer, the
        # query-time gate through `is_transform_active`, the Explore indicator's
        # active verdict and the preview endpoint, all of which already consult
        # this function.
        return [
            MappingValidationIssue(
                field=field,
                message=_(
                    "A value transform must be a single SQL expression. It "
                    "cannot carry a FROM, WHERE, GROUP BY or any other clause, "
                    "and it cannot contain a sub-query."
                ),
                blocking=True,
            )
        ]

    if not contains_value_placeholder(transform):
        return [
            MappingValidationIssue(
                field=field,
                message=_(
                    "The value transform must contain the :value placeholder, "
                    "which stands for the filter value being mirrored."
                ),
                blocking=False,
            )
        ]

    if not placeholder_is_executable(transform, engine):
        # Blocking, and for the same reason the shape gate above is: this is
        # the function the PUT, the importer, `is_transform_active`, the
        # Explore indicator and the preview all consult, so one issue here
        # closes every door at once. A placeholder inside a string literal is
        # a sub-query the engine will run once a filter value closes the quote;
        # one inside a comment silently eats the probe's own alias.
        return [
            MappingValidationIssue(
                field=field,
                message=_(
                    "The :value placeholder must appear where the engine will "
                    "evaluate it. It cannot sit inside a string literal or a "
                    "comment."
                ),
                blocking=True,
            )
        ]

    if functions := find_non_deterministic_functions(transform, engine):
        return [
            MappingValidationIssue(
                field=field,
                message=_(
                    "The value transform calls %(functions)s, whose result "
                    "depends on when and where it runs. The transform is "
                    "evaluated in a separate session and the result is cached, "
                    "so the emitted predicate would freeze a snapshot of that "
                    "moment.",
                    functions=", ".join(sorted(functions)),
                ),
                blocking=True,
            )
        ]

    return []


@lru_cache(maxsize=LRU_CACHE_MAX_SIZE)
def is_transform_active(transform: str | None, engine: str) -> bool:
    """
    Whether Superset will mirror filters through this transform.

    `validate_transform` with the messages discarded, so the Explore indicator
    cannot advertise a mapping the save path recorded as inactive. Anything
    cheaper here would be a second, weaker statement of the same rule, free to
    drift from the one the save path applies.

    Blocking issues count too. Jinja and non-deterministic transforms are
    rejected on PUT, but `CreateDatasetCommand` and import do not validate the
    mapping, so one can still reach the database -- and it would never mirror a
    filter either.

    Memoized because `partition_filter_mapping_summary` is serialized on every
    Explore and dashboard load and this parses the transform. The key is
    everything the answer depends on: `validate_transform` reads no session, no
    locale and no config beyond `SQL_MAX_PARSE_LENGTH`, which bounds the parser
    rather than changing a verdict within that bound.
    """
    return not validate_transform(transform, engine)


def preview_partition_mapping(  # pylint: disable=too-many-return-statements
    datasource: SqlaTable,
    *,
    mapped_column: str,
    value_transform: str | None,
    sample_values: list[str],
    operator: FilterOperator = FilterOperator.EQUALS,
    is_monotonic: bool = False,
    partition_column: str | None = None,
) -> dict[str, Any]:
    """
    Evaluate a candidate mapping and describe the predicate it would emit.

    Shares the evaluator -- and therefore the probe cache -- with the query
    path, so preview and runtime cannot drift and a previewed transform warms
    the chart path for free. The predicate itself comes from
    `build_mirrored_predicates`, the same builder the query path uses, so
    operator shapes cannot drift either: what the panel shows is what a chart
    would emit.

    Validation runs first and the engine second: a half-typed transform is by
    definition unparseable, so most of what a text input produces costs zero
    queries.

    Every part of the mapping is taken from the request rather than the stored
    dataset. The editor previews while the owner is still editing -- a mapping
    that has to be saved before it can be checked is not a preview.
    """
    partition_column = partition_column or datasource.partition_column
    if not partition_column:
        return {
            "valid": False,
            "reason": "unconfigured",
            "error": _("No partition column is set."),
        }

    columns_by_name = {str(column.column_name): column for column in datasource.columns}
    if mapped_column not in columns_by_name:
        return {
            "valid": False,
            "reason": "validation",
            "error": _("%(name)s is not a column on this dataset.", name=mapped_column),
        }

    # The bail-out `resolve_partition_mapping` makes at query time, and that
    # `partition_filter_mapping_summary` repeats for the Explore indicator.
    # Without it here, preview reports a valid emitted predicate for a mapping
    # no chart will ever mirror -- the one answer a preview panel must not give.
    if has_active_advanced_data_type(columns_by_name[mapped_column]):
        return {
            "valid": False,
            "reason": "validation",
            "error": _(
                "%(name)s has an advanced data type, so its filters are "
                "translated into their own predicate shape and cannot be "
                "mirrored onto the partition column.",
                name=mapped_column,
            ),
        }

    engine = datasource.database.backend
    for issue in validate_partition_mapping(
        column_names=set(columns_by_name),
        partition_column=str(partition_column),
        partition_mapped_column=mapped_column,
        main_dttm_col=datasource.main_dttm_col,
        transform=value_transform,
        engine=engine,
    ):
        return {
            "valid": False,
            # The parse failure is the one an owner sees constantly, and it is
            # the only one the mockup gives its own headline to.
            "reason": (
                "parse"
                if issue.field == "partition_value_transform"
                and not is_parseable(value_transform, engine)
                else "validation"
            ),
            "error": str(issue.message),
        }

    # The policy every other stored expression goes through. The save path
    # applies it in `UpdateDatasetCommand._validate_partition_mapping`, but
    # preview evaluates a candidate transform that has not been saved, so
    # without this the gate had a door around it. See
    # `stored_expression_error` for what is being kept out and why.
    if reason := stored_expression_error(
        datasource.database,
        datasource.catalog,
        datasource.schema,
        cast(str, value_transform),
    ):
        return {"valid": False, "reason": "validation", "error": reason}

    mapping = PartitionMapping(
        partition_column=str(partition_column),
        mapped_column=mapped_column,
        value_transform=cast(str, value_transform),
        is_monotonic=is_monotonic,
        equality_is_safe=equality_mirrors_safely(
            columns_by_name[mapped_column], datasource.database.db_engine_spec
        ),
    )
    sample_input = _render_sample_input(
        datasource, mapped_column, operator, sample_values
    )

    if operator not in PREVIEWABLE_OPERATORS:
        # Checked before `mirrors`, which lets `TEMPORAL_RANGE` through when the
        # transform is declared monotonic -- and the single sample value would
        # then reach `handle_comparison_filter`, which has no case for a range
        # and raises. The request schema rejects it too; this keeps the function
        # honest for any other caller.
        return {
            "valid": False,
            "reason": "operator",
            "sample_input": sample_input,
            "error": _(
                "A %(operator)s filter is mirrored as a pair of bounds, which "
                "a preview of a single value cannot describe.",
                operator=operator.value,
            ),
        }

    if not mapping.mirrors(operator):
        return {
            "valid": False,
            "reason": "operator",
            "sample_input": sample_input,
            "error": _(
                "A %(operator)s filter is only mirrored when the transform "
                "preserves ordering, which this one is not declared to do.",
                operator=operator.value,
            ),
        }

    value = _probe_input(
        datasource, columns_by_name[mapped_column], operator, sample_values
    )
    errors: list[str] = []
    type_errors: list[str] = []
    predicates = build_mirrored_predicates(
        datasource,
        mapping,
        [(operator, value)],
        errors=errors,
        type_errors=type_errors,
    )
    if type_errors:
        # Its own reason, because "the database would not evaluate this" and
        # "it evaluated and answered with the wrong kind of thing" are
        # different problems with different fixes, and the owner is the only
        # one who can tell which transform they meant to write.
        return {
            "valid": False,
            "reason": "type",
            "sample_input": sample_input,
            "error": type_errors[0],
        }
    if not predicates:
        return {
            "valid": False,
            "reason": "engine",
            "sample_input": sample_input,
            "error": (
                _(
                    "The transform could not be evaluated against the "
                    "database: %(reason)s",
                    reason=errors[0],
                )
                if errors
                else _("The transform could not be evaluated against the database.")
            ),
        }

    return {
        "valid": True,
        "sample_input": sample_input,
        "emitted_predicate": _render_predicate(datasource, predicates[0]),
    }


def _probe_input(
    datasource: SqlaTable,
    column: "TableColumn",
    operator: FilterOperator,
    sample_values: list[str],
) -> Any:
    """
    The sample values as the query path would bind them.

    The request carries samples as strings, and the probe is keyed on exactly
    what it is handed, so passing them through raw asks the engine a different
    question from the one a chart asks. A sample of ``2025`` on a numeric
    column has to arrive as the integer the chart compares: under a transform
    of ``typeof(:value)`` the raw string previewed ``'text'`` where the chart
    emitted ``'integer'``. And because `_probe_cache_key` keys on each value's
    ``repr``, the two also missed each other's cache entirely -- so the "a
    previewed transform warms the chart path for free" claim in
    `preview_partition_mapping`'s docstring did not actually hold.

    Coerced by `filter_values_handler`, the same function the query path uses,
    rather than by a second implementation of the same rules.

    Ranges are not previewable (see `PREVIEWABLE_OPERATORS`), so the bound
    conversion `_collect_partition_mirror_range` applies -- a ``datetime`` into
    the column's stored representation -- has no counterpart here.
    """
    is_list = operator == FilterOperator.IN
    column_spec = datasource.db_engine_spec.get_column_spec(native_type=column.type)
    handled = datasource.filter_values_handler(
        # `list[str]` is not a `list[FilterValue]` to mypy, invariantly, even
        # though every `str` is a `FilterValue`.
        values=cast(FilterValues, sample_values if is_list else sample_values[0]),
        operator=operator,
        target_generic_type=(
            column_spec.generic_type if column_spec else utils.GenericDataType.STRING
        ),
        target_native_type=column.type,
        is_list_target=is_list,
        db_engine_spec=datasource.db_engine_spec,
        db_extra=datasource.db_extra,
    )

    def bindable(value: Any) -> Any:
        # An epoch-milliseconds sample on a temporal column comes back as
        # engine SQL rather than a value, and SQL cannot be the value of a bind
        # parameter -- carried as text so the probe substitutes it, the same way
        # an array literal is.
        if isinstance(value, ColumnElement):
            return raw_probe_value(datasource.database, value)
        return value

    if is_list and isinstance(handled, (list, tuple)):
        return [bindable(entry) for entry in handled]
    return bindable(handled)


def _render_sample_input(
    datasource: SqlaTable,
    mapped_column: str,
    operator: FilterOperator,
    values: list[str],
) -> str:
    """
    The filter being previewed, written the way an owner would read it.

    Display-only -- it is never executed -- but it is still read as SQL, so the
    column is quoted and the values are rendered by the dialect rather than
    concatenated raw. A column named ``order date`` would otherwise come out as
    two bare words.
    """
    quoted = datasource.quote_identifier(mapped_column)
    if operator == FilterOperator.IN:
        rendered = ", ".join(
            _render_literal(datasource.database, value) for value in values
        )
        return f"{quoted} IN ({rendered})"
    return (
        f"{quoted} {operator.value} {_render_literal(datasource.database, values[0])}"
    )


def _render_predicate(datasource: SqlaTable, predicate: ColumnElement[Any]) -> str:
    """
    Compile a mirrored predicate to the text a reader would see in View query.

    Every value in it is a probed constant by this point, so ``literal_binds``
    renders the same literals the chart query carries.
    """
    return _compile_literal(predicate, _dialect_for(datasource.database)).replace(
        "\n", " "
    )


def _render_literal(database: Database, value: Any) -> str:
    """
    Render a value the way it appears in the generated SQL.

    Compiled by the dialect rather than formatted by hand. `str()` would render
    a NULL as the Python repr `None` and leave a date unquoted, neither of which
    is SQL, and hand-rolled quote-doubling would only ever have been right for
    strings.
    """
    return _compile_literal(sa.literal(value), _dialect_for(database))


def build_mirrored_predicates(
    datasource: SqlaTable,
    mapping: PartitionMapping,
    requests: list[tuple[FilterOperator, Any]],
    *,
    errors: list[str] | None = None,
    type_errors: list[str] | None = None,
) -> list[ColumnElement[Any]]:
    """
    Turn collected ``(operator, value)`` mirror requests into predicates.

    ``requests`` is expected to be deduplicated by the caller. Every value is
    resolved in a single probe round trip -- one per chart query at most -- then
    emitted as a literal constant, so "View query" shows the reader an ordinary
    ``WHERE`` clause rather than an inline expression.

    A strict bound is emitted non-strictly; see `mirror_operator`. That happens
    here, at the one point where a ``FilterOperator`` becomes SQL, rather than
    at the collection sites in `ExploreMixin`: the preview endpoint calls this
    directly, so this is what keeps the predicate the editor shows an owner and
    the predicate the chart carries from disagreeing.

    :param errors: optional sink; see `evaluate_transform`.
    :param type_errors: optional sink for a probe result the partition column
        cannot hold -- see `probed_value_type_error`. Separate from ``errors``
        because the two say different things to an owner: that one is "the
        database would not evaluate this", and this one is "it evaluated, and
        answered with the wrong kind of thing".
    """
    if not requests:
        return []

    partition_column = next(
        (
            column
            for column in datasource.columns
            if column.column_name == mapping.partition_column
        ),
        None,
    )
    if partition_column is None:
        return []

    # Flatten every value that needs probing into one list, remembering how many
    # each request consumed so the results can be handed back out.
    flat: list[Any] = []
    spans: list[tuple[FilterOperator, int, int]] = []
    for operator, value in requests:
        values = list(value) if operator == FilterOperator.IN else [value]
        spans.append((operator, len(flat), len(values)))
        flat.extend(values)

    evaluated = evaluate_transform(
        datasource.database,
        datasource.catalog,
        datasource.schema,
        mapping.value_transform,
        flat,
        errors=errors,
    )
    if evaluated is None:
        return []

    if not _bounds_are_ordered(evaluated, spans):
        return []

    # Declining here is the last chance to decline at all: once these
    # predicates are in the statement, a value the partition column cannot
    # hold fails the whole chart rather than its pruning.
    if reason := probed_value_type_error(partition_column, evaluated):
        logger.warning(
            "Partition transform returned a value the partition column cannot "
            "hold; queries will not prune: %s",
            reason,
        )
        if type_errors is not None:
            type_errors.append(reason)
        record_mirror_verdict(
            datasource.database,
            datasource.catalog,
            datasource.schema,
            mapping.value_transform,
            mirrors=False,
        )
        return []

    sqla_col = datasource.convert_tbl_column_to_sqla_col(partition_column)
    predicates = _predicates_from_probe(
        sqla_col, datasource.db_engine_spec, evaluated, spans
    )
    if not predicates:
        return []

    # A comparison against a NULL partition value is NULL, so a row parked in a
    # NULL partition is dropped by the mirror even when the real filter matches
    # it -- Hive and Impala's default partition, or a transform that returns
    # NULL for an input it cannot convert. The mirror only has to be no
    # narrower than the filter it stands in for, so admitting NULL partitions
    # keeps those rows. Engines still prune; they read one extra partition.
    return [sa.or_(sa.and_(*predicates), sqla_col.is_(None))]


def _predicates_from_probe(
    sqla_col: ColumnElement[Any],
    db_engine_spec: type[BaseEngineSpec],
    evaluated: list[Any],
    spans: list[tuple[FilterOperator, int, int]],
) -> list[ColumnElement[Any]]:
    """
    One predicate on the partition column per surviving mirror request.

    A request whose probe answered `None` for any of its values is skipped
    rather than emitted: `col = NULL` is `NULL`, so it would drop every row the
    filter keeps. A strict bound is emitted non-strictly; see `mirror_operator`.
    """
    predicates: list[ColumnElement[Any]] = []
    for operator, start, length in spans:
        chunk = evaluated[start : start + length]
        if any(value is None for value in chunk):
            continue
        if operator == FilterOperator.IN:
            # The probe answers per value, so a transform over a mixed-number
            # filter can answer with a mixed-number partition key -- and
            # `in_` infers the bind type from the first element it is handed.
            # Without this, probe results of `[33, 29.02]` emit
            # `IN (33, 29)` and prune away the partition holding `29.02`.
            predicates.append(sqla_col.in_(normalize_mixed_numbers(chunk)))
        else:
            predicates.append(
                db_engine_spec.handle_comparison_filter(
                    sqla_col, mirror_operator(operator), chunk[0]
                )
            )
    return predicates


#: Operators whose value is the lower end of a range, and whose upper-end twins.
#:
#: Shared with `ExploreMixin._mirror_probe_input`, which rounds a bound *outward*
#: where the engine resolves it more coarsely than the filter carries -- backward
#: for a lower bound, forward for an upper one. Which end an operator names is
#: the only thing separating the two directions in either caller, so the two have
#: to agree on it rather than each classify for itself.
LOWER_BOUND_OPERATORS = {
    FilterOperator.GREATER_THAN,
    FilterOperator.GREATER_THAN_OR_EQUALS,
}
UPPER_BOUND_OPERATORS = {
    FilterOperator.LESS_THAN,
    FilterOperator.LESS_THAN_OR_EQUALS,
}


#: What Python type a probe result may have, per generic type of the partition
#: column it is about to be compared against.
#:
#: Only the types a mismatch can actually break a query with are listed. An
#: unresolvable column type is absent because there is nothing to check
#: against, and ``MULTI_VALUE`` because this module does not mirror onto an
#: array partition key at all.
#: ``numbers.Number`` rather than ``(int, float)``: Postgres answers
#: ``extract(epoch from ...)`` with a `Decimal`, which is the single commonest
#: transform this feature has, and an engine is free to answer with any number
#: type its driver prefers. What the check is for is a *string* where a number
#: belongs, and every numeric type is equally not that.
_PROBE_RESULT_TYPES: dict[utils.GenericDataType, tuple[type, ...]] = {
    utils.GenericDataType.NUMERIC: (numbers.Number,),
    utils.GenericDataType.BOOLEAN: (bool,),
    # A day key such as ``to_char(:value, 'YYYYMMDD')`` is legitimately text.
    utils.GenericDataType.TEMPORAL: (datetime, date, str),
    # Text, and not a number rendered as one. Not every engine accepts a number
    # in a text comparison: Postgres refuses ``character varying = integer``,
    # Trino ``varchar = bigint`` and BigQuery ``STRING = INT64``, all of which
    # fail the whole chart once the predicate is in the statement. SQLite is
    # worse -- it raises nothing and compares across storage classes as never
    # equal, so the mirror drops every row rather than losing pruning, which is
    # the one outcome this feature may not have. An owner whose partition key
    # really is text writes the cast into the transform.
    utils.GenericDataType.STRING: (str,),
}


def probed_value_type_error(
    partition_column: "TableColumn",
    values: Sequence[Any],
) -> str | None:
    """
    Why these probe results cannot be compared against the partition column.

    A transform can evaluate perfectly and still answer with something the
    partition column cannot hold: ``cast(:value as text) || 'x'`` against a
    ``BIGINT`` partition key probes fine, passes the ordering check -- two
    strings compare -- and then reaches `handle_comparison_filter`, which is
    just ``col >= value``. SQLAlchemy takes the bind's type from the *value*
    rather than from the column, so the engine is the first thing to object,
    and it objects by failing the whole chart: by that point the predicate is
    in the statement and there is nothing left to fail open.

    So the mismatch is caught here, where declining still costs only the
    pruning, and reported to the preview, where the owner can see it before
    they save. Nothing else in this module looks at the partition column's own
    type: every other gate is about the mapped column.

    Fails open wherever it has no information -- an unresolvable column type,
    a generic type with nothing a mismatch can break -- and closed only on a
    clear mismatch. ``bool`` is excluded from ``NUMERIC`` on purpose: it
    satisfies `isinstance(x, int)` -- and `numbers.Number` -- while rendering
    as ``true``, which is not a number to any engine that cares.
    """
    try:
        generic_type = partition_column.type_generic
    except Exception:  # pylint: disable=broad-except  # noqa: BLE001
        return None
    if generic_type is None:
        return None

    allowed = _PROBE_RESULT_TYPES.get(generic_type)
    if allowed is None:
        return None

    for value in values:
        if value is None:
            # Handled by the caller's own NULL guard, which skips the request.
            continue
        # `bool` is checked separately because it satisfies every numeric
        # `isinstance` there is while rendering as `true`.
        held = isinstance(value, allowed) and (
            bool in allowed or not isinstance(value, bool)
        )
        if not held:
            return str(
                _(
                    "The transform returned %(returned)s for %(column)s, which "
                    "is %(kind)s. Mirrored filters on this mapping would fail "
                    "at the database.",
                    returned=repr(value),
                    column=partition_column.column_name,
                    kind=generic_type.name.lower(),
                )
            )
    return None


def _bounds_are_ordered(
    evaluated: list[Any],
    spans: list[tuple[FilterOperator, int, int]],
) -> bool:
    """
    Backstop for the monotonicity *declaration*: check ``T(lower) <= T(upper)``.

    Both bounds have already been probed, so this costs nothing extra. It is a
    *necessary* condition, not a sufficient one: it catches an inverted
    transform, and catches ``hour()`` on any range spanning a day boundary, but
    not ``hour()`` inside a single day. A cheap sanity check on a claim only the
    dataset owner can actually make -- not a replacement for the declaration.
    """
    lowers = [
        evaluated[start]
        for operator, start, _ in spans
        if operator in LOWER_BOUND_OPERATORS
    ]
    uppers = [
        evaluated[start]
        for operator, start, _ in spans
        if operator in UPPER_BOUND_OPERATORS
    ]
    if not lowers or not uppers:
        return True

    try:
        return bool(max(lowers) <= min(uppers))
    except TypeError:
        # Probe results arrive through `get_df` as pandas/numpy scalars, which
        # do not all compare. "Not comparable" is failure, not permission.
        logger.warning(
            "Partition transform produced incomparable bounds; not mirroring"
        )
        return False
