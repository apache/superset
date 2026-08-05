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
"""Unit tests for the operational instrumentation in
``superset.tasks.version_history_retention``.

Covers the branches that emit statsd counters: the ``retention_days <= 0``
short-circuit, incomplete shadow-table resolution, the ``OperationalError``
retry path, and the terminal failure counter. The
"happy path" / SERIALIZABLE retry behaviour against a real database is
exercised by ``tests/integration_tests/versioning/retention_prune_tests.py``;
this file pins the metric-emission contract that is load-bearing for
operator alerting.
"""

from __future__ import annotations

from collections.abc import Iterator
from unittest.mock import MagicMock, patch

import pytest
from sqlalchemy.exc import OperationalError
from sqlalchemy_continuum.exc import ClassNotVersioned

from superset.tasks import version_history_retention


@pytest.fixture(name="stats")
def _stats_fixture() -> Iterator[MagicMock]:
    """Patch the shared stats logger so every test can assert on
    emissions without standing up the real statsd backend."""
    with patch.object(
        version_history_retention, "stats_logger_manager"
    ) as mock_manager:
        mock_manager.instance = MagicMock()
        yield mock_manager.instance


def test_retention_disabled_emits_skipped_metric(stats: MagicMock) -> None:
    """``retention_days <= 0`` is the documented "disable retention"
    config. The early-return must emit ``superset.versioning.retention.skipped``
    so a dashboard can tell "operator disabled it" apart from "scheduler
    isn't running"."""
    result = version_history_retention._prune_old_versions_impl(retention_days=0)
    assert result == {"skipped": 1}
    stats.incr.assert_called_once_with("superset.versioning.retention.skipped")
    stats.gauge.assert_not_called()


def test_task_normalizes_string_retention_config(stats: MagicMock) -> None:
    """String values from custom config modules are normalized to integers."""
    mock_app: MagicMock = MagicMock()
    mock_app.config = {"SUPERSET_VERSION_HISTORY_RETENTION_DAYS": "30"}
    with (
        patch.object(version_history_retention, "current_app", mock_app),
        patch.object(
            version_history_retention,
            "_prune_old_versions_impl",
            return_value={"pruned_transactions": 0},
        ) as prune,
    ):
        result = version_history_retention.prune_old_versions()

    assert result == {"pruned_transactions": 0}
    prune.assert_called_once_with(30)
    stats.incr.assert_not_called()


def test_incomplete_shadow_table_resolution_fails_closed(
    stats: MagicMock,
) -> None:
    """Missing shadow metadata must abort before the destructive pass."""
    with (
        patch.object(
            version_history_retention,
            "_resolve_shadow_tables",
            side_effect=RuntimeError("missing shadow"),
        ),
        pytest.raises(RuntimeError, match="missing shadow"),
    ):
        version_history_retention._prune_old_versions_impl(retention_days=30)
    stats.incr.assert_not_called()


def test_resolve_shadow_tables_rejects_partial_registry() -> None:
    """One missing versioned mapper makes the complete registry unsafe."""
    resolved_table: MagicMock = MagicMock()

    def resolve_version_class(model: type[object]) -> MagicMock:
        if model.__name__ == "TableColumn":
            raise ClassNotVersioned(model)
        version_model = MagicMock()
        version_model.__table__ = resolved_table
        return version_model

    with patch("sqlalchemy_continuum.version_class", side_effect=resolve_version_class):
        with pytest.raises(RuntimeError, match="TableColumn"):
            version_history_retention._resolve_shadow_tables(MagicMock())


def test_serialization_failure_then_success_increments_retried_once(
    stats: MagicMock,
) -> None:
    """A single ``OperationalError`` on attempt 1 should:
    * fire ``.retried`` once (one retry happened),
    * sleep for ``_RETRY_BACKOFF_BASE_SECONDS`` (patched away in tests),
    * succeed on attempt 2 with ``stats["retried"] == 1``,
    * fire ``.pruned_transactions`` gauge with the success count.

    The contract on ``.retried`` is "fires per retry attempt observed"
    (per-attempt, not per-session). This test pins the per-attempt shape so
    a future refactor doesn't silently change the metric semantics."""
    pass_fn: MagicMock = MagicMock(
        side_effect=[
            OperationalError("SELECT 1", {}, Exception("could not serialize access")),
            {"pruned_transactions": 7, "cutoff": "2026-01-01T00:00:00"},
        ]
    )
    tables = version_history_retention.ShadowTables(
        parent=[MagicMock()], child=[MagicMock()], m2m=None, transaction=MagicMock()
    )
    with (
        patch.object(
            version_history_retention, "_resolve_shadow_tables", return_value=tables
        ),
        patch.object(version_history_retention, "_run_prune_pass", pass_fn),
        patch.object(version_history_retention.time, "sleep"),
    ):
        result = version_history_retention._prune_old_versions_impl(retention_days=30)

    assert result["retried"] == 1
    assert result["pruned_transactions"] == 7
    incr_calls = [call.args[0] for call in stats.incr.call_args_list]
    assert incr_calls == ["superset.versioning.retention.retried"], (
        f"Expected exactly one .retried emission; got {incr_calls}"
    )
    stats.gauge.assert_called_once_with(
        "superset.versioning.retention.pruned_transactions", 7
    )


def test_all_attempts_fail_reraises_after_max_retries(stats: MagicMock) -> None:
    """When every attempt raises ``OperationalError``, the task re-raises
    after ``_MAX_RETRY_ATTEMPTS`` so the outer Celery wrapper logs it.
    The retry counter fires once per attempt that hit the exception."""
    exc: OperationalError = OperationalError("SELECT 1", {}, Exception("conflict"))
    tables = version_history_retention.ShadowTables(
        parent=[MagicMock()], child=[MagicMock()], m2m=None, transaction=MagicMock()
    )
    with (
        patch.object(
            version_history_retention, "_resolve_shadow_tables", return_value=tables
        ),
        patch.object(version_history_retention, "_run_prune_pass", side_effect=exc),
        patch.object(version_history_retention.time, "sleep"),
        pytest.raises(OperationalError),
    ):
        version_history_retention._prune_old_versions_impl(retention_days=30)

    incr_calls = [call.args[0] for call in stats.incr.call_args_list]
    assert (
        incr_calls.count("superset.versioning.retention.retried")
        == version_history_retention._MAX_RETRY_ATTEMPTS
    ), (
        f"Expected {version_history_retention._MAX_RETRY_ATTEMPTS} "
        f".retried emissions (one per attempt); got {incr_calls}"
    )


def test_terminal_failure_emits_failed_metric_and_swallows(stats: MagicMock) -> None:
    """The Celery wrapper catches a terminal failure, returns ``{"error": 1}``
    (so the schedule isn't poisoned), AND emits a ``.failed`` counter so the
    destructive job's primary failure mode is alertable, not just logged."""
    mock_app: MagicMock = MagicMock()
    mock_app.config = {"SUPERSET_VERSION_HISTORY_RETENTION_DAYS": 30}
    with (
        patch.object(version_history_retention, "current_app", mock_app),
        patch.object(
            version_history_retention,
            "_prune_old_versions_impl",
            side_effect=RuntimeError("boom"),
        ),
    ):
        result = version_history_retention.prune_old_versions()

    assert result == {"error": 1}
    stats.incr.assert_called_once_with("superset.versioning.retention.failed")
