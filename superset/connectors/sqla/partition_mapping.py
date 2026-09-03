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
``col = v``, ``col IN (...)``                always -- ``T`` is a function
``col >=|>|<|<= v``, ``TEMPORAL_RANGE``      only if ``T`` is monotonic
``col != v``, ``NOT IN``, ``LIKE``, ...      never
===========================================  =============================

Negations are never safe because ``T`` need not be injective:
``lower(:value)`` with ``country != 'US'`` mirrors to ``region_key != 'us'``,
which wrongly excludes rows whose ``country`` is already lowercase ``'us'`` --
rows the original filter *keeps*.

Monotonicity is a property of the transform, not of the column's data type:
``hour(:value)``, ``date_format(:value, 'dd')`` and ``dayofweek(:value)`` are
all reasonable transforms on a ``TIMESTAMP`` column and none of them preserve
ordering. It is therefore declared by the owner, not inferred.
"""

from __future__ import annotations

import hashlib
import logging
import re
from dataclasses import dataclass
from typing import Any, cast, TYPE_CHECKING

import sqlalchemy as sa
from flask import current_app as app
from flask_babel import lazy_gettext as _
from sqlalchemy.engine.interfaces import Dialect
from sqlalchemy.sql.elements import ColumnElement

from superset.exceptions import SupersetParseError
from superset.extensions import cache_manager, feature_flag_manager
from superset.sql.parse import SQLStatement
from superset.utils import json
from superset.utils.core import FilterOperator

if TYPE_CHECKING:
    from superset.connectors.sqla.models import SqlaTable, TableColumn
    from superset.models.core import Database

logger = logging.getLogger(__name__)

FEATURE_FLAG = "PARTITION_FILTER_MAPPING"

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


def mirrorable_operators(is_monotonic: bool) -> set[FilterOperator]:
    """
    The operators whose predicates may be mirrored onto the partition column.

    :param is_monotonic: whether the owner declared the transform
        order-preserving
    """
    if is_monotonic:
        return MIRRORABLE_ALWAYS | MIRRORABLE_IF_MONOTONIC
    return set(MIRRORABLE_ALWAYS)


@dataclass(frozen=True)
class PartitionMapping:
    """A resolved, usable partition filter mapping."""

    partition_column: str
    mapped_column: str
    value_transform: str
    is_monotonic: bool

    def mirrors(self, operator: FilterOperator) -> bool:
        return operator in mirrorable_operators(self.is_monotonic)


def contains_value_placeholder(transform: str | None) -> bool:
    """Whether the transform contains the ``:value`` placeholder."""
    return bool(transform) and VALUE_PLACEHOLDER_RE.search(transform or "") is not None


def contains_jinja(transform: str | None) -> bool:
    """Whether the transform contains a balanced Jinja block."""
    return bool(transform) and JINJA_BLOCK_RE.search(transform or "") is not None


def parse_skeleton(transform: str) -> str:
    """
    The transform with ``:value`` substituted out, ready for a SQL parser.

    ``sanitize_clause`` / sqlglot choke on a bare ``:value`` on most dialects,
    so the placeholder is swapped for a benign literal first -- the same trick
    ``validate_stored_expression`` uses for Jinja blocks.
    """
    return VALUE_PLACEHOLDER_RE.sub(_PARSE_STANDIN, transform)


#: Prefix the transform is wrapped in before parsing. Its length is subtracted
#: from any reported column so positions refer to what the owner actually typed.
_SELECT_PREFIX = "SELECT "


def _parse_skeleton(transform: str, engine: str) -> SQLStatement | None:
    """
    Parse ``SELECT <transform>`` with the placeholder substituted out.

    Returns ``None`` when the transform does not parse.
    """
    try:
        return SQLStatement(f"{_SELECT_PREFIX}{parse_skeleton(transform)}", engine)
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


def is_parseable(transform: str | None, engine: str) -> bool:
    """Whether the transform parses as a single select expression."""
    if not transform or not transform.strip():
        return False
    return _parse_skeleton(transform, engine) is not None


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
    if not _transform_is_usable(transform, datasource.database.backend):
        return None

    if _has_active_advanced_data_type(mapped_column):
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
    )


def _transform_is_usable(transform: str | None, engine: str) -> bool:
    """
    Whether the transform is safe to evaluate and mirror through.

    Mirrors the Tier-2 half of `validate_partition_mapping` plus the Jinja
    block, so a mapping saved before a check existed -- or one whose engine
    changed underneath it -- is still skipped at query time.
    """
    if not transform or not transform.strip():
        return False
    if not contains_value_placeholder(transform):
        return False
    if contains_jinja(transform):
        return False
    return is_parseable(transform, engine)


def _has_active_advanced_data_type(column: TableColumn) -> bool:
    advanced_data_type = getattr(column, "advanced_data_type", None)
    if not advanced_data_type:
        return False
    if not feature_flag_manager.is_feature_enabled("ENABLE_ADVANCED_DATA_TYPES"):
        return False
    return advanced_data_type in app.config.get("ADVANCED_DATA_TYPES", {})


def build_probe_sql(
    transform: str,
    values: list[Any],
    dialect: Dialect | None = None,
) -> str:
    """
    Compile a single ``SELECT`` that evaluates the transform at every value.

    Values are attacker-controlled (a Gamma user picks filter values), so they
    are bound as parameters and rendered by the dialect's own literal processor
    rather than interpolated into the SQL text.

    Note this deliberately does *not* go through ``BaseEngineSpec``'s text
    helper, which escapes ``:`` on every engine but Athena and would destroy the
    ``:value`` placeholder before it can be bound.
    """
    selections = []
    for index, value in enumerate(values):
        clause = sa.text(transform).bindparams(sa.bindparam("value", value=value))
        compiled = clause.compile(
            dialect=dialect,
            compile_kwargs={"literal_binds": True},
        )
        selections.append(f"{compiled} AS v{index}")
    return "SELECT " + ", ".join(selections)


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
    try:
        sql = build_probe_sql(transform, distinct, _dialect_for(database))
        frame = database.get_df(sql=sql, catalog=catalog, schema=schema)
        if frame is None or frame.empty:
            logger.warning(
                "Partition transform probe returned no rows; skipping mirroring"
            )
            return None
        row = frame.iloc[0]
        if len(row) < len(distinct):
            # The results cannot be aligned back to their inputs; skipping
            # beats guessing which value produced which column.
            logger.warning(
                "Partition transform probe returned %d values for %d inputs",
                len(row),
                len(distinct),
            )
            return None
        return [row.iloc[index] for index in range(len(distinct))]
    except Exception as ex:  # pylint: disable=broad-except
        logger.warning(
            "Partition transform probe failed; queries will not prune",
            exc_info=True,
        )
        if errors is not None:
            errors.append(str(ex))
        return None


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
    exist, a column cannot be mapped onto itself, and the transform cannot carry
    Jinja or call a non-deterministic function. Tier 2 (``blocking=False``) is
    everything that merely leaves the mapping inactive.

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

    effective_mapped_column = partition_mapped_column or main_dttm_col
    if effective_mapped_column and effective_mapped_column == partition_column:
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

    column_names = {str(column.column_name) for column in datasource.columns}
    if mapped_column not in column_names:
        return {
            "valid": False,
            "reason": "validation",
            "error": _("%(name)s is not a column on this dataset.", name=mapped_column),
        }

    engine = datasource.database.backend
    for issue in validate_partition_mapping(
        column_names=column_names,
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

    mapping = PartitionMapping(
        partition_column=str(partition_column),
        mapped_column=mapped_column,
        value_transform=cast(str, value_transform),
        is_monotonic=is_monotonic,
    )
    sample_input = _render_sample_input(mapped_column, operator, sample_values)

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

    value: Any = sample_values if operator == FilterOperator.IN else sample_values[0]
    errors: list[str] = []
    predicates = build_mirrored_predicates(
        datasource, mapping, [(operator, value)], errors=errors
    )
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


def _render_sample_input(
    mapped_column: str,
    operator: FilterOperator,
    values: list[str],
) -> str:
    """The filter being previewed, written the way an owner would read it."""
    if operator == FilterOperator.IN:
        rendered = ", ".join(_render_literal(value) for value in values)
        return f"{mapped_column} IN ({rendered})"
    return f"{mapped_column} {operator.value} {_render_literal(values[0])}"


def _render_predicate(datasource: SqlaTable, predicate: ColumnElement[Any]) -> str:
    """
    Compile a mirrored predicate to the text a reader would see in View query.

    Every value in it is a probed constant by this point, so ``literal_binds``
    renders the same literals the chart query carries.
    """
    return str(
        predicate.compile(
            dialect=_dialect_for(datasource.database),
            compile_kwargs={"literal_binds": True},
        )
    ).replace("\n", " ")


def _render_literal(value: Any) -> str:
    """Render a probed value the way it appears in the generated SQL."""
    if isinstance(value, str):
        escaped = value.replace("'", "''")
        return f"'{escaped}'"
    return str(value)


def build_mirrored_predicates(
    datasource: SqlaTable,
    mapping: PartitionMapping,
    requests: list[tuple[FilterOperator, Any]],
    *,
    errors: list[str] | None = None,
) -> list[ColumnElement[Any]]:
    """
    Turn collected ``(operator, value)`` mirror requests into predicates.

    ``requests`` is expected to be deduplicated by the caller. Every value is
    resolved in a single probe round trip -- one per chart query at most -- then
    emitted as a literal constant, so "View query" shows the reader an ordinary
    ``WHERE`` clause rather than an inline expression.

    :param errors: optional sink; see `evaluate_transform`.
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

    sqla_col = datasource.convert_tbl_column_to_sqla_col(partition_column)
    db_engine_spec = datasource.db_engine_spec

    predicates: list[ColumnElement[Any]] = []
    for operator, start, length in spans:
        chunk = evaluated[start : start + length]
        if any(value is None for value in chunk):
            continue
        if operator == FilterOperator.IN:
            predicates.append(sqla_col.in_(chunk))
        else:
            predicates.append(
                db_engine_spec.handle_comparison_filter(sqla_col, operator, chunk[0])
            )
    return predicates


_LOWER_BOUND_OPS = {
    FilterOperator.GREATER_THAN,
    FilterOperator.GREATER_THAN_OR_EQUALS,
}
_UPPER_BOUND_OPS = {
    FilterOperator.LESS_THAN,
    FilterOperator.LESS_THAN_OR_EQUALS,
}


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
        evaluated[start] for operator, start, _ in spans if operator in _LOWER_BOUND_OPS
    ]
    uppers = [
        evaluated[start] for operator, start, _ in spans if operator in _UPPER_BOUND_OPS
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
