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

from typing import Any
from unittest.mock import patch

import pytest
from flask import current_app

from superset.commands.deletion_retention import prune_audit
from superset.commands.deletion_retention.prune_audit import (
    BATCH_SIZE,
    MAX_BATCHES_PER_RUN,
    OPERATIONAL_STATUSES,
    PROTECTED_STATUSES,
    PruneRunResult,
    resolve_evidence_retention_days,
    resolve_operational_retention_days,
)
from superset.models.purge_audit_log import (
    STATUS_BLOCKED,
    STATUS_CONFIRMED,
    STATUS_FAILED,
    STATUS_PENDING,
    STATUS_TARGET_ABSENT,
)


def test_categories_partition_the_status_vocabulary() -> None:
    """Every non-pending status is exactly one of operational or protected;
    pending belongs to neither (reconciliation owns it)."""
    assert OPERATIONAL_STATUSES == {STATUS_BLOCKED, STATUS_FAILED}
    assert PROTECTED_STATUSES == {STATUS_CONFIRMED, STATUS_TARGET_ABSENT}
    assert not OPERATIONAL_STATUSES & PROTECTED_STATUSES
    assert STATUS_PENDING not in OPERATIONAL_STATUSES | PROTECTED_STATUSES


def test_batch_constants_match_the_run_budget_contract() -> None:
    """500-row batches, ten per run, shared across categories."""
    assert BATCH_SIZE == 500
    assert MAX_BATCHES_PER_RUN == 10


def test_operational_retention_defaults_to_ninety_days() -> None:
    current_app.config.pop("PURGE_AUDIT_RETENTION_DAYS", None)
    assert resolve_operational_retention_days() == 90


@pytest.mark.parametrize("value", [30, 1, 36500])
def test_operational_retention_accepts_positive_days(value: int) -> None:
    with patch.dict(current_app.config, {"PURGE_AUDIT_RETENTION_DAYS": value}):
        assert resolve_operational_retention_days() == value


@pytest.mark.parametrize("value", [0, -5, True, False, "ninety", None, 1.5])
def test_operational_retention_fails_closed_on_invalid_values(value: Any) -> None:
    """Invalid values disable the category (None) — they never widen removal."""
    with patch.dict(current_app.config, {"PURGE_AUDIT_RETENTION_DAYS": value}):
        assert resolve_operational_retention_days() is None


def test_evidence_retention_defaults_to_off_without_warning() -> None:
    """``None`` is the documented never-expire default, not a config error."""
    current_app.config.pop("PURGE_AUDIT_EVIDENCE_RETENTION_DAYS", None)
    with patch.object(prune_audit, "logger") as mock_logger:
        assert resolve_evidence_retention_days() is None
        mock_logger.warning.assert_not_called()


def test_evidence_retention_accepts_the_explicit_opt_in() -> None:
    with patch.dict(current_app.config, {"PURGE_AUDIT_EVIDENCE_RETENTION_DAYS": 3650}):
        assert resolve_evidence_retention_days() == 3650


@pytest.mark.parametrize("value", [0, -1, True, "forever"])
def test_evidence_retention_fails_closed_on_invalid_values(value: Any) -> None:
    with patch.dict(current_app.config, {"PURGE_AUDIT_EVIDENCE_RETENTION_DAYS": value}):
        with patch.object(prune_audit, "logger") as mock_logger:
            assert resolve_evidence_retention_days() is None
            mock_logger.warning.assert_called_once()


def test_prune_run_result_totals_and_dict_shape() -> None:
    result = PruneRunResult(
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
    """FR-007: a disabled run emits the skipped metric and log line and
    never reaches the prune implementation."""
    from superset.tasks import deletion_retention as task_module

    with patch.dict(current_app.config, {"PURGE_AUDIT_PRUNING_ENABLED": False}):
        with (
            patch.object(task_module, "stats_logger_manager") as mock_stats,
            patch.object(task_module, "logger") as mock_logger,
            patch.object(task_module.prune_audit, "run_prune") as mock_run,
        ):
            outcome = task_module.prune_purge_audit()
    assert outcome == {"skipped_disabled": 1}
    mock_run.assert_not_called()
    mock_stats.instance.incr.assert_called_once_with(
        "deletion_retention.prune_audit.skipped_disabled"
    )
    assert mock_logger.info.called


def test_failed_run_is_isolated_and_distinguishable() -> None:
    """FR-008: a raising run reports failure (metric + exception log) and
    returns an error marker — never mistakable for 'removed nothing'."""
    from superset.tasks import deletion_retention as task_module

    with patch.dict(current_app.config, {"PURGE_AUDIT_PRUNING_ENABLED": True}):
        with (
            patch.object(task_module, "stats_logger_manager") as mock_stats,
            patch.object(
                task_module.prune_audit,
                "run_prune",
                side_effect=RuntimeError("boom"),
            ),
        ):
            outcome = task_module.prune_purge_audit()
    assert outcome == {"error": 1}
    mock_stats.instance.incr.assert_called_once_with(
        "deletion_retention.prune_audit.failed"
    )


def test_successful_run_mirrors_counts_into_metrics() -> None:
    """SC-003: the per-category counts are answerable from metrics alone."""
    from superset.tasks import deletion_retention as task_module

    fake = PruneRunResult(
        blocked_duplicates=7, operational_expired=4, evidence_expired=0
    )
    with patch.dict(current_app.config, {"PURGE_AUDIT_PRUNING_ENABLED": True}):
        with (
            patch.object(task_module, "stats_logger_manager") as mock_stats,
            patch.object(task_module.prune_audit, "run_prune", return_value=fake),
        ):
            outcome = task_module.prune_purge_audit()
    assert outcome == fake.as_dict()
    mock_stats.instance.incr.assert_called_once_with(
        "deletion_retention.prune_audit.success"
    )
    gauges = {
        call.args[0]: call.args[1] for call in mock_stats.instance.gauge.call_args_list
    }
    assert gauges == {
        "deletion_retention.prune_audit.removed.blocked_duplicates": 7,
        "deletion_retention.prune_audit.removed.operational_expired": 4,
        "deletion_retention.prune_audit.removed.evidence_expired": 0,
    }


def test_utc_clock_matches_the_audit_write_path() -> None:
    """The cutoff clock must be the audit module's naive-UTC clock — a
    local-time cutoff would shift the window by the server's UTC offset."""
    from superset.commands.deletion_retention import audit

    prune_now = prune_audit._utc_now()
    audit_now = audit._utc_now()
    assert prune_now.tzinfo is None
    assert abs((audit_now - prune_now).total_seconds()) < 5


def test_delete_batch_short_circuits_on_empty_ids() -> None:
    """An empty candidate list must not touch the session at all."""
    with patch.object(prune_audit, "db") as mock_db:
        assert prune_audit._delete_batch([], frozenset({STATUS_BLOCKED})) == 0
    mock_db.session.execute.assert_not_called()
