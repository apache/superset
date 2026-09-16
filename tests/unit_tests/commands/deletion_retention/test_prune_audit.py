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
"""Unit tests for the pure parts of purge-audit pruning.

Query behavior against real rows (streak survivors, batching, protection
invariants) is covered by
``tests/integration_tests/deletion_retention/prune_audit_tests.py``.
"""

from __future__ import annotations

from contextlib import contextmanager
from datetime import datetime
from decimal import Decimal
from functools import partial
from typing import Any, Iterator
from unittest.mock import MagicMock, patch
from uuid import UUID, uuid4

import pytest
import sqlalchemy as sa
from flask import current_app
from sqlalchemy.dialects import mysql, postgresql, sqlite

from superset.commands.deletion_retention import prune_audit
from superset.commands.deletion_retention.prune_audit import (
    EVIDENCE_RETENTION_KEY,
    OPERATIONAL_RETENTION_KEY,
    OPERATIONAL_STATUSES,
    PROTECTED_STATUSES,
    PruneRunResult,
    resolve_evidence_retention_days,
    resolve_operational_retention_days,
)
from superset.models.purge_audit_log import (
    ALL_STATUSES,
    STATUS_BLOCKED,
    STATUS_CONFIRMED,
    STATUS_FAILED,
    STATUS_PENDING,
    STATUS_TARGET_ABSENT,
)

_METRIC_PREFIX: str = "deletion_retention.prune_purge_audit"


@contextmanager
def without_config(key: str) -> Iterator[None]:
    """Remove a config key for the duration of the block, then restore it.

    ``patch.dict`` cannot express key *removal*, and the unit-test app
    fixture is module-scoped, so a bare ``pop`` would leak to later tests.
    """
    with patch.dict(current_app.config):
        current_app.config.pop(key, None)
        yield


def test_retention_categories_partition_every_status() -> None:
    """Require every status to belong to a retention category.

    A new status added to the model without a category would silently never
    be pruned; this assertion catches that omission.
    """
    assert OPERATIONAL_STATUSES == {STATUS_BLOCKED, STATUS_FAILED}
    assert PROTECTED_STATUSES == {STATUS_CONFIRMED, STATUS_TARGET_ABSENT}
    assert not OPERATIONAL_STATUSES & PROTECTED_STATUSES
    assert OPERATIONAL_STATUSES | PROTECTED_STATUSES | {STATUS_PENDING} == ALL_STATUSES


def test_only_proof_of_destruction_breaks_a_blockage_streak() -> None:
    """Require destruction evidence to break a blockage streak.

    A failed attempt is an infrastructure outcome, and pending is provisional.
    Neither proves that the blockage cleared.
    """
    assert prune_audit._STREAK_BREAKING_STATUSES == {
        STATUS_CONFIRMED,
        STATUS_TARGET_ABSENT,
    }
    assert STATUS_FAILED not in prune_audit._STREAK_BREAKING_STATUSES
    assert STATUS_PENDING not in prune_audit._STREAK_BREAKING_STATUSES


def test_operational_retention_defaults_to_ninety_days() -> None:
    """Use the shipped 90-day operational retention default."""
    assert current_app.config[OPERATIONAL_RETENTION_KEY] == 90
    assert resolve_operational_retention_days().days == 90


@pytest.mark.parametrize("value", [30, 1, 36500])
def test_operational_retention_accepts_positive_days(value: int) -> None:
    with patch.dict(current_app.config, {OPERATIONAL_RETENTION_KEY: value}):
        assert resolve_operational_retention_days() == (value, None)


@pytest.mark.parametrize("value", [0, -5, True, False, "ninety", None, 1.5])
def test_operational_retention_fails_closed_on_invalid_values(value: Any) -> None:
    """Disable a category and identify its invalid configuration key."""
    with patch.dict(current_app.config, {OPERATIONAL_RETENTION_KEY: value}):
        window: prune_audit.ResolvedWindow = resolve_operational_retention_days()
    assert window.days is None
    assert window.invalid_key == OPERATIONAL_RETENTION_KEY


def test_missing_operational_key_is_reported_as_invalid_not_assumed() -> None:
    """A popped key is operator error, not a silent 90-day assumption."""
    with without_config(OPERATIONAL_RETENTION_KEY):
        window: prune_audit.ResolvedWindow = resolve_operational_retention_days()
    assert window.days is None
    assert window.invalid_key == OPERATIONAL_RETENTION_KEY


def test_evidence_retention_defaults_to_off_without_warning() -> None:
    """Unset is the documented never-expire default (FR-006), not an error:
    disabled, no warning, and no key reported as invalid."""
    with without_config(EVIDENCE_RETENTION_KEY):
        with patch.object(prune_audit, "logger") as mock_logger:
            window: prune_audit.ResolvedWindow = resolve_evidence_retention_days()
        mock_logger.warning.assert_not_called()
    assert window == (None, None)


def test_evidence_retention_accepts_the_explicit_opt_in() -> None:
    with patch.dict(current_app.config, {EVIDENCE_RETENTION_KEY: 3650}):
        window: prune_audit.ResolvedWindow = resolve_evidence_retention_days()
    assert window.days == 3650


@pytest.mark.parametrize("value", [0, -1, True, "forever"])
def test_evidence_retention_fails_closed_on_invalid_values(value: Any) -> None:
    with patch.dict(current_app.config, {EVIDENCE_RETENTION_KEY: value}):
        with patch.object(prune_audit, "logger") as mock_logger:
            window: prune_audit.ResolvedWindow = resolve_evidence_retention_days()
        mock_logger.warning.assert_called_once()
    assert window.days is None
    assert window.invalid_key == EVIDENCE_RETENTION_KEY


def test_batch_size_defaults_to_fifty() -> None:
    """Use the shipped batch-size default (keeps a concurrent writer's wait
    around a second on MySQL on a long multi-reason history)."""
    assert current_app.config[prune_audit.BATCH_SIZE_KEY] == 50
    assert prune_audit.BATCH_SIZE == 50
    assert prune_audit.resolve_batch_size().size == 50


def test_unset_batch_size_falls_back_to_the_module_default_silently() -> None:
    """An absent key means the module default, with no warning.

    Absence is distinguished from an explicit ``None``, which is invalid.
    """
    with without_config(prune_audit.BATCH_SIZE_KEY):
        with patch.object(prune_audit, "logger") as mock_logger:
            resolved: prune_audit.ResolvedBatchSize = prune_audit.resolve_batch_size()
        mock_logger.warning.assert_not_called()
    assert resolved == (prune_audit.BATCH_SIZE, None)


@pytest.mark.parametrize("value", [1, 50, 100, 500])
def test_batch_size_accepts_integers_within_the_cap(value: int) -> None:
    """A non-boolean int in [1, cap] is used as-is."""
    with patch.dict(current_app.config, {prune_audit.BATCH_SIZE_KEY: value}):
        assert prune_audit.resolve_batch_size() == (value, None)


@pytest.mark.parametrize(
    "value",
    [
        None,  # explicit None is a present, invalid value — not absence
        0,
        -10,
        501,
        True,
        False,
        2.5,
        100.0,  # an integral float is still not an int
        Decimal("100.7"),  # would silently truncate under int()
        "100",  # numeric strings are not coerced
        "fifty",
        [100],
    ],
)
def test_batch_size_fails_closed_on_invalid_values(value: Any) -> None:
    """Any present value that is not a non-boolean int in range is refused.

    Nothing is coerced — an explicit ``None``, a numeric string, a float, a
    ``Decimal`` — so the advertised integer-only contract holds; the run is
    disabled and the key identified, never a guessed batch size.
    """
    with patch.dict(current_app.config, {prune_audit.BATCH_SIZE_KEY: value}):
        with patch.object(prune_audit, "logger") as mock_logger:
            resolved: prune_audit.ResolvedBatchSize = prune_audit.resolve_batch_size()
        mock_logger.warning.assert_called_once()
    assert resolved.size is None
    assert resolved.invalid_key == prune_audit.BATCH_SIZE_KEY


def test_invalid_batch_size_skips_the_whole_run_and_reports_the_key() -> None:
    """An invalid batch size prunes nothing at all and names the key.

    The batch size governs every category, so unlike a bad retention key
    (which disables one category) the whole run fails closed.
    """
    mock_drain: MagicMock
    with patch.dict(current_app.config, {prune_audit.BATCH_SIZE_KEY: 0}):
        with patch.object(prune_audit, "_drain") as mock_drain:
            result: PruneRunResult = prune_audit.run_prune()
    mock_drain.assert_not_called()
    assert result.total_removed == 0
    assert result.invalid_config_keys == [prune_audit.BATCH_SIZE_KEY]


def test_configured_batch_size_reaches_every_batch() -> None:
    """The resolved size is what every batch discovers and keys "drained" on."""
    mock_delete: MagicMock
    with patch.dict(current_app.config, {prune_audit.BATCH_SIZE_KEY: 7}):
        with patch.object(
            prune_audit, "_delete_batch", return_value=(3, 3)
        ) as mock_delete:
            prune_audit.run_prune()
    assert mock_delete.call_args_list
    assert all(call.args[2] == 7 for call in mock_delete.call_args_list)


def test_prune_run_result_totals_and_dict_shape() -> None:
    result: PruneRunResult = PruneRunResult(
        blocked_duplicates=3, operational_expired=2, evidence_expired=1
    )
    assert result.total_removed == 6
    assert result.as_dict() == {
        "removed": {
            "blocked_duplicates": 3,
            "operational_expired": 2,
            "evidence_expired": 1,
        },
        "carried_over": False,
        "invalid_config_keys": [],
    }


def test_disabled_task_reports_itself_and_removes_nothing() -> None:
    """Report a disabled run without reaching the prune implementation."""
    from superset.tasks import deletion_retention as task_module

    with patch.dict(current_app.config, {"PURGE_AUDIT_PRUNING_ENABLED": False}):
        with (
            patch.object(task_module, "stats_logger_manager") as mock_stats,
            patch.object(task_module, "logger") as mock_logger,
            patch.object(task_module.prune_audit, "run_prune") as mock_run,
        ):
            outcome: dict[str, Any] = task_module.prune_purge_audit()
    assert outcome == {"skipped_disabled": 1}
    mock_run.assert_not_called()
    mock_stats.instance.incr.assert_called_once_with(
        f"{_METRIC_PREFIX}.skipped_disabled"
    )
    assert mock_logger.info.called


@pytest.mark.parametrize("value", ["false", "0", 1, None])
def test_non_boolean_master_switch_fails_closed(value: Any) -> None:
    """Never interpret truthy strings or numeric values as deletion opt-in."""
    from superset.tasks import deletion_retention as task_module

    with patch.dict(current_app.config, {"PURGE_AUDIT_PRUNING_ENABLED": value}):
        with (
            patch.object(task_module, "stats_logger_manager") as mock_stats,
            patch.object(task_module.prune_audit, "run_prune") as mock_run,
        ):
            outcome: dict[str, Any] = task_module.prune_purge_audit()

    assert outcome == {"skipped_invalid_config": 1}
    mock_run.assert_not_called()
    mock_stats.instance.incr.assert_called_once_with(
        f"{_METRIC_PREFIX}.skipped_invalid_config"
    )


def test_failed_run_is_isolated_rolled_back_and_distinguishable() -> None:
    """Report and isolate a failed pruning run.

    The task rolls back and returns an error marker that cannot be mistaken
    for a successful run that removed nothing.
    """
    from superset.tasks import deletion_retention as task_module

    with patch.dict(current_app.config, {"PURGE_AUDIT_PRUNING_ENABLED": True}):
        with (
            patch.object(task_module, "stats_logger_manager") as mock_stats,
            patch.object(task_module, "db") as mock_db,
            patch.object(
                task_module.prune_audit,
                "run_prune",
                side_effect=RuntimeError("boom"),
            ),
        ):
            outcome: dict[str, Any] = task_module.prune_purge_audit()
    assert outcome == {"error": 1}
    mock_db.session.rollback.assert_called_once()
    mock_stats.instance.incr.assert_called_once_with(f"{_METRIC_PREFIX}.failed")


def test_successful_run_mirrors_counts_and_carryover_into_metrics() -> None:
    """Expose category counts and convergence through metrics."""
    from superset.tasks import deletion_retention as task_module

    fake: PruneRunResult = PruneRunResult(
        blocked_duplicates=7,
        operational_expired=4,
        evidence_expired=0,
        carried_over=True,
    )
    with patch.dict(current_app.config, {"PURGE_AUDIT_PRUNING_ENABLED": True}):
        with (
            patch.object(task_module, "stats_logger_manager") as mock_stats,
            patch.object(task_module.prune_audit, "run_prune", return_value=fake),
        ):
            outcome: dict[str, Any] = task_module.prune_purge_audit()
    assert outcome == fake.as_dict()
    mock_stats.instance.incr.assert_called_once_with(f"{_METRIC_PREFIX}.success")
    gauges: dict[str, int] = {
        call.args[0]: call.args[1] for call in mock_stats.instance.gauge.call_args_list
    }
    assert gauges == {
        f"{_METRIC_PREFIX}.removed.blocked_duplicates": 7,
        f"{_METRIC_PREFIX}.removed.operational_expired": 4,
        f"{_METRIC_PREFIX}.removed.evidence_expired": 0,
        f"{_METRIC_PREFIX}.carried_over": 1,
    }


def test_invalid_config_has_a_distinct_metric_from_success() -> None:
    """Keep invalid retention configuration out of the success counter."""
    from superset.tasks import deletion_retention as task_module

    fake: PruneRunResult = PruneRunResult(
        invalid_config_keys=[OPERATIONAL_RETENTION_KEY]
    )
    with patch.dict(current_app.config, {"PURGE_AUDIT_PRUNING_ENABLED": True}):
        with (
            patch.object(task_module, "stats_logger_manager") as mock_stats,
            patch.object(task_module.prune_audit, "run_prune", return_value=fake),
        ):
            outcome: dict[str, Any] = task_module.prune_purge_audit()

    assert outcome == fake.as_dict()
    mock_stats.instance.incr.assert_called_once_with(f"{_METRIC_PREFIX}.invalid_config")


def test_locked_recheck_is_a_select_and_delete_names_only_literal_ids() -> None:
    """The locked re-check + delete must not hit MySQL's ERROR 1093.

    MySQL rejects a DELETE whose subquery reads the target table. The candidacy
    re-check therefore runs as a SELECT (which may read ``purge_audit_log`` via
    its correlated boundary/repeat/pending subqueries), and the DELETE names
    only the literal surviving-id list — so ``purge_audit_log`` appears exactly
    once in the DELETE (its target), never inside a subquery.
    """
    table = prune_audit.PurgeAuditLog.__table__
    now: datetime = datetime(2026, 1, 1)

    recheck: sa.sql.Select = sa.select(table.c.id).where(
        table.c.id.in_([1, 2, 3]), *prune_audit._duplicate_predicates(table, now)
    )
    recheck_sql: str = str(recheck.compile(dialect=mysql.dialect()))
    delete_sql: str = str(
        sa.delete(table)
        .where(table.c.id.in_([1, 2, 3]))
        .compile(dialect=mysql.dialect())
    )

    # The re-check is a SELECT that legitimately reads the table (aliased).
    assert recheck_sql.startswith("SELECT")
    assert "purge_audit_log" in recheck_sql
    # The DELETE has no subquery reading the target table — the property that
    # keeps it clear of ERROR 1093. Its WHERE is a literal id list, not a
    # SELECT; ``purge_audit_log`` appears only as the target and the qualified
    # id column, never inside a nested SELECT.
    assert delete_sql.startswith("DELETE FROM purge_audit_log")
    assert "SELECT" not in delete_sql


@pytest.mark.parametrize(
    ("dialect", "same_reason_operator"),
    [
        (postgresql.dialect(), "IS NOT DISTINCT FROM"),
        (mysql.dialect(), "<=>"),
        (sqlite.dialect(), " IS "),
    ],
)
def test_reason_comparison_is_null_safe_on_every_supported_dialect(
    dialect: Any, same_reason_operator: str
) -> None:
    """Compare block reasons NULL-safely so pre-feature rows form a run.

    A plain ``=`` would never match two reason-less rows, so every legacy
    block would be its own survivor and the streak would never dedupe.
    """
    now: datetime = datetime(2026, 1, 1)
    for select_candidates in (
        partial(prune_audit._duplicate_candidates, now),
        partial(prune_audit._operational_candidates, now, now),
    ):
        # The reason comparison lives in the candidacy predicates, which the
        # discovery select and the locked re-check share; compile the discovery
        # select (LIMIT-bounded) and assert the null-safe operator per dialect.
        sql: str = str(
            select_candidates(prune_audit.BATCH_SIZE).compile(dialect=dialect)
        )
        assert same_reason_operator in sql


def test_pruning_shares_the_audit_writers_clock() -> None:
    """Use the audit writer's clock when calculating retention cutoffs."""
    from superset.commands.deletion_retention import audit

    assert prune_audit.utc_now is audit.utc_now


@pytest.mark.parametrize(
    "dialect", [postgresql.dialect(), mysql.dialect(), sqlite.dialect()]
)
def test_repeat_history_scope_is_only_present_for_locked_rechecks(dialect: Any) -> None:
    """Limit history to candidate entities only when a batch scope is supplied."""
    table: sa.Table = prune_audit.PurgeAuditLog.__table__
    now: datetime = datetime(2026, 1, 1)
    scope_entities: list[tuple[str, str | None]] = [
        ("dashboard", "b"),
        ("chart", "a"),
        ("chart", "a"),
    ]
    scoped: sa.sql.Select = sa.select(table.c.id).where(
        *prune_audit._duplicate_predicates(table, now, scope_entities=scope_entities)
    )
    unscoped: sa.sql.Select = sa.select(table.c.id).where(
        *prune_audit._duplicate_predicates(table, now)
    )
    scoped_sql: str = str(
        scoped.compile(dialect=dialect, compile_kwargs={"literal_binds": True})
    )
    unscoped_sql: str = str(unscoped.compile(dialect=dialect))
    assert scoped_sql.count("entity_type IN ('chart', 'dashboard')") == 3
    assert scoped_sql.count("entity_uuid IN ('a', 'b')") == 3
    assert "repeat_scope" not in scoped_sql
    assert "entity_type IN" not in unscoped_sql
    assert "entity_uuid IN" not in unscoped_sql


def test_maximum_literal_scope_executes_with_sqlite_bind_budget() -> None:
    """Account for repeated positional scope binds at the 500-id ceiling."""
    engine: sa.Engine = sa.create_engine("sqlite://")
    metadata: sa.MetaData = sa.MetaData()
    table: sa.Table = prune_audit.PurgeAuditLog.__table__.to_metadata(metadata)
    ids: list[UUID] = [uuid4() for _ in range(prune_audit.MAX_BATCH_SIZE)]
    pairs: list[tuple[str, str | None]] = [
        (f"type-{i}", f"entity-{i}") for i in range(len(ids))
    ]
    query: sa.sql.Select = sa.select(table.c.id).where(
        table.c.id.in_(ids),
        *prune_audit._duplicate_predicates(
            table, datetime(2026, 1, 1), scope_entities=pairs
        ),
    )
    compiled: sa.sql.compiler.Compiled = query.compile(
        dialect=sqlite.dialect(), compile_kwargs={"render_postcompile": True}
    )
    assert 1500 < len(compiled.params) < 1550
    assert compiled.positiontup is not None
    assert 3500 < len(compiled.positiontup) < 3550
    try:
        metadata.create_all(engine)
        with engine.connect() as connection:
            assert list(connection.scalars(query)) == []
    finally:
        engine.dispose()


def test_repeat_query_uses_lag_without_ctes() -> None:
    """Keep the measured derived-table shape without materialized group self-joins."""
    table: sa.Table = prune_audit.PurgeAuditLog.__table__
    query: sa.sql.Select = sa.select(table.c.id).where(
        *prune_audit._duplicate_predicates(
            table, datetime(2026, 1, 1), scope_entities=[("chart", "entity")]
        )
    )
    sql: str = str(query.compile(dialect=postgresql.dialect())).lower()
    assert "with " not in sql
    assert "lag(" in sql
    assert "dense_rank(" not in sql
    # The point of the shape: every LAG shares one named window, so the
    # engine makes a single ordered pass instead of one per column.
    assert sql.count("window w as (") == 1
    assert sql.count("over w") == 5
    assert "over (partition" not in sql


@pytest.mark.parametrize("count", [1, 2, prune_audit.MAX_BATCH_SIZE])
def test_delete_batch_forwards_bounded_entity_scope_to_the_locked_recheck(
    count: int,
) -> None:
    """Use at most one distinct entity pair per discovered id."""
    ids: list[UUID] = [uuid4() for _ in range(count)]
    scope_entities: list[tuple[str, str | None]] = [
        ("chart", str(i)) for i in range(count)
    ]
    select_candidates: MagicMock = MagicMock()
    recheck_predicates: MagicMock = MagicMock(return_value=[])
    mock_db: MagicMock
    with (
        patch.object(prune_audit, "db") as mock_db,
        patch.object(prune_audit, "acquire_coordination_lock"),
    ):
        mock_db.session.execute.side_effect = [
            [(value,) for value in ids],
            scope_entities,
            [],
        ]
        assert prune_audit._delete_batch(
            select_candidates, recheck_predicates, count
        ) == (
            count,
            0,
        )
    recheck_predicates.assert_called_once_with(
        prune_audit.PurgeAuditLog.__table__, scope_entities=scope_entities
    )
    assert len(recheck_predicates.call_args.kwargs["scope_entities"]) <= len(ids)
    mock_db.session.rollback.assert_called_once()


def test_delete_batch_reads_entity_scope_only_after_the_fresh_snapshot_lock() -> None:
    """Pin discovery, fresh-snapshot scope lookup, SQL re-check and deletion order."""
    table: sa.Table = prune_audit.PurgeAuditLog.__table__
    ids: list[UUID] = [uuid4(), uuid4()]
    pairs: list[tuple[str, str | None]] = [("chart", "entity"), ("chart", None)]
    discovery: sa.sql.Select = sa.select(table.c.id).limit(2)
    select_candidates: MagicMock = MagicMock(return_value=discovery)
    recheck_predicates: MagicMock = MagicMock(return_value=[])
    events: MagicMock = MagicMock()
    mock_db: MagicMock
    lock: MagicMock
    with (
        patch.object(prune_audit, "db") as mock_db,
        patch.object(prune_audit, "acquire_coordination_lock") as lock,
    ):
        events.attach_mock(mock_db.session.execute, "execute")
        events.attach_mock(mock_db.session.rollback, "rollback")
        events.attach_mock(lock, "lock")
        events.attach_mock(mock_db.session.commit, "commit")
        mock_db.session.execute.side_effect = [
            [(id_,) for id_ in ids],
            pairs,
            [(ids[0],)],
            MagicMock(rowcount=1),
        ]
        assert prune_audit._delete_batch(select_candidates, recheck_predicates, 2) == (
            2,
            1,
        )
    assert [event[0] for event in events.mock_calls] == [
        "execute",
        "rollback",
        "lock",
        "execute",
        "execute",
        "execute",
        "commit",
    ]
    lock.assert_called_once_with(mock_db.session)
    select_candidates.assert_called_once_with(2)
    recheck_predicates.assert_called_once_with(table, scope_entities=pairs)
    assert mock_db.session.execute.call_args_list[0].args[0] is discovery
    scope_select: sa.sql.Select = mock_db.session.execute.call_args_list[1].args[0]
    scope_sql: str = str(
        scope_select.compile(
            dialect=postgresql.dialect(),
            compile_kwargs={"literal_binds": True},
        )
    )
    assert scope_sql.startswith(
        "SELECT DISTINCT purge_audit_log.entity_type, purge_audit_log.entity_uuid"
    )
    assert "WHERE purge_audit_log.id IN" in scope_sql
    assert all(str(id_) in scope_sql for id_ in ids)
    assert str(mock_db.session.execute.call_args_list[2].args[0]).startswith("SELECT")
    delete_sql: str = str(
        mock_db.session.execute.call_args_list[3]
        .args[0]
        .compile(
            dialect=postgresql.dialect(),
            compile_kwargs={"literal_binds": True},
        )
    )
    assert delete_sql.startswith("DELETE FROM purge_audit_log")
    assert str(ids[0]) in delete_sql
    assert str(ids[1]) not in delete_sql
    assert "SELECT" not in delete_sql


@pytest.mark.parametrize(
    ("scope_entities", "has_repeat"),
    [
        ([("chart", "entity")], True),
        ([], False),
        ([("chart", None)], False),
    ],
)
def test_window_repeat_predicate_executes_on_sqlite(
    scope_entities: list[tuple[str, str | None]],
    has_repeat: bool,
) -> None:
    """Preserve mixed-reason ties and force rows in SQLite window execution."""
    engine: sa.Engine = sa.create_engine("sqlite://")
    metadata: sa.MetaData = sa.MetaData()
    table: sa.Table = prune_audit.PurgeAuditLog.__table__.to_metadata(metadata)
    ids: list[UUID] = [uuid4() for _ in range(5)]
    rows: list[dict[str, Any]] = [
        {
            "id": id_,
            "entity_type": "chart",
            "entity_uuid": "entity",
            "status": STATUS_BLOCKED,
            "trigger": trigger,
            "actor": "system",
            "created_on": datetime(2026, 1, day),
            "reason": reason,
        }
        for id_, day, reason, trigger in zip(
            ids,
            [1, 2, 3, 3, 4],
            [None, None, None, "changed", "changed"],
            ["scheduled", "scheduled", "scheduled", "scheduled", "force"],
            strict=False,
        )
    ]
    try:
        metadata.create_all(engine)
        with engine.begin() as connection:
            connection.execute(sa.insert(table), rows)
            assert set(
                connection.scalars(
                    sa.select(table.c.id).where(
                        prune_audit._repeats_an_earlier_block(
                            table, datetime(2026, 2, 1), scope_entities=scope_entities
                        )
                    )
                )
            ) == ({ids[1]} if has_repeat else set())
    finally:
        engine.dispose()
