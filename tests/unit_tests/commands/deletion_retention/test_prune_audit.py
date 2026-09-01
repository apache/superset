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
from functools import partial
from typing import Any, Iterator
from unittest.mock import patch

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


def test_atomic_delete_uses_a_mysql_compatible_derived_table() -> None:
    """Wrap the self-referencing candidate query for MySQL deletion."""

    def select_candidates(limit: int) -> sa.sql.Select:
        return prune_audit._duplicate_candidates(datetime(2026, 1, 1), limit)

    statement: sa.sql.Delete = prune_audit._delete_statement(select_candidates)
    sql: str = str(statement.compile(dialect=mysql.dialect()))

    assert "DELETE FROM purge_audit_log" in sql
    assert "prune_candidates" in sql
    assert "SELECT" in sql


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
        sql: str = str(
            prune_audit._delete_statement(select_candidates).compile(dialect=dialect)
        )
        assert same_reason_operator in sql


def test_pruning_shares_the_audit_writers_clock() -> None:
    """Use the audit writer's clock when calculating retention cutoffs."""
    from superset.commands.deletion_retention import audit

    assert prune_audit.utc_now is audit.utc_now
