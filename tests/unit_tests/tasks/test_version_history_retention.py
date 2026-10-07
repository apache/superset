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

Covers the branches that emit statsd counters: the disabled-retention
short-circuit, incomplete shadow-table resolution, the ``OperationalError``
retry path, and the terminal failure counter. The
"happy path" / SERIALIZABLE retry behaviour against a real database is
exercised by ``tests/integration_tests/versioning/retention_prune_tests.py``;
this file pins the metric-emission contract that is load-bearing for
operator alerting.
"""

from __future__ import annotations

from collections.abc import Iterator
from datetime import datetime
from typing import Any, cast
from unittest.mock import call, MagicMock, patch

import pytest
import sqlalchemy as sa
from flask import Flask
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
    """``retention_days == 0`` is the documented "disable retention"
    config. The early-return must emit ``superset.versioning.retention.skipped``
    so a dashboard can tell "operator disabled it" apart from "scheduler
    isn't running"."""
    result = version_history_retention._prune_old_versions_impl(retention_days=0)
    assert result == {"skipped": 1}
    stats.incr.assert_called_once_with("superset.versioning.retention.skipped")
    stats.gauge.assert_not_called()


@pytest.mark.parametrize("value", [0, -1, 360, "360", "-1"])
def test_task_reads_canonical_application_retention(
    stats: MagicMock, value: int | str
) -> None:
    """Runtime overrides use the canonical key, without a legacy fallback."""
    app: Flask = Flask(__name__)
    app.config.update(
        VERSION_HISTORY_RETENTION_DAYS=value,
        SUPERSET_VERSION_HISTORY_RETENTION_DAYS=180,
    )
    prune: MagicMock
    with (
        app.app_context(),
        patch.object(
            version_history_retention, "_prune_old_versions_impl", return_value={}
        ) as prune,
    ):
        assert version_history_retention.prune_old_versions() == {}
    prune.assert_called_once_with(int(value), max_per_run=1000, dry_run=False)
    stats.incr.assert_not_called()


@pytest.mark.parametrize(
    ("legacy", "expected"),
    [(180, 180), (0, 0), (-1, 0), (-7, 0), (1000000000, 0)],
)
def test_task_preserves_legacy_only_custom_application_config(
    stats: MagicMock, legacy: int, expected: int
) -> None:
    """A wholly custom app config without the new key keeps 7.0 retention."""
    app: Flask = Flask(__name__)
    app.config["SUPERSET_VERSION_HISTORY_RETENTION_DAYS"] = legacy
    prune: MagicMock
    with (
        app.app_context(),
        patch.object(
            version_history_retention, "_prune_old_versions_impl", return_value={}
        ) as prune,
    ):
        assert version_history_retention.prune_old_versions() == {}
    prune.assert_called_once_with(expected, max_per_run=1000, dry_run=False)


@pytest.mark.parametrize(("legacy", "expected"), [(0, 0), (365, 365)])
def test_task_keeps_legacy_when_custom_module_imports_new_default(
    stats: MagicMock, legacy: int, expected: int
) -> None:
    """A star-imported 30-day default must not shorten a released window."""
    app: Flask = Flask(__name__)
    app.config.update(
        VERSION_HISTORY_RETENTION_DAYS=30,
        SUPERSET_VERSION_HISTORY_RETENTION_DAYS=legacy,
    )
    prune: MagicMock
    with (
        app.app_context(),
        patch.object(
            version_history_retention, "_prune_old_versions_impl", return_value={}
        ) as prune,
    ):
        assert version_history_retention.prune_old_versions() == {}
    prune.assert_called_once_with(expected, max_per_run=1000, dry_run=False)


@pytest.mark.parametrize(("canonical", "legacy"), [(7, 365), (365, 0), (-1, -1)])
def test_task_honors_explicit_canonical_config_with_legacy_key_present(
    stats: MagicMock, canonical: int, legacy: int
) -> None:
    """A distinct canonical value wins even while an old key remains."""
    app: Flask = Flask(__name__)
    app.config.update(
        VERSION_HISTORY_RETENTION_DAYS=canonical,
        SUPERSET_VERSION_HISTORY_RETENTION_DAYS=legacy,
    )
    prune: MagicMock
    with (
        app.app_context(),
        patch.object(
            version_history_retention, "_prune_old_versions_impl", return_value={}
        ) as prune,
    ):
        assert version_history_retention.prune_old_versions() == {}
    prune.assert_called_once_with(canonical, max_per_run=1000, dry_run=False)


@pytest.mark.parametrize("value", [-1.0, -1.5, True, False, None, "abc", "30d"])
def test_task_does_not_coerce_invalid_input_to_immediate(
    value: object, stats: MagicMock, caplog: pytest.LogCaptureFixture
) -> None:
    """A malformed runtime config defers pruning with 0, never immediate cleanup."""
    app: Flask = Flask(__name__)
    app.config["VERSION_HISTORY_RETENTION_DAYS"] = value
    prune: MagicMock
    with (
        app.app_context(),
        patch.object(
            version_history_retention, "_prune_old_versions_impl", return_value={}
        ) as prune,
    ):
        assert version_history_retention.prune_old_versions.run() == {}
    prune.assert_called_once_with(0, max_per_run=1000, dry_run=False)
    stats.incr.assert_not_called()
    assert "Invalid VERSION_HISTORY_RETENTION_DAYS" in caplog.text


def test_task_env_canonical_precedes_legacy_key(
    stats: MagicMock, monkeypatch: pytest.MonkeyPatch
) -> None:
    """An explicit environment window is never widened by a legacy key."""
    monkeypatch.setenv("VERSION_HISTORY_RETENTION_DAYS", "30")
    app: Flask = Flask(__name__)
    app.config.update(
        VERSION_HISTORY_RETENTION_DAYS=30,
        SUPERSET_VERSION_HISTORY_RETENTION_DAYS=365,
    )
    prune: MagicMock
    with (
        app.app_context(),
        patch.object(
            version_history_retention, "_prune_old_versions_impl", return_value={}
        ) as prune,
    ):
        assert version_history_retention.prune_old_versions() == {}
    prune.assert_called_once_with(30, max_per_run=1000, dry_run=False)


def test_task_without_either_key_uses_environment_seed(stats: MagicMock) -> None:
    """A config carrying neither key falls back to the parsed default window."""
    app: Flask = Flask(__name__)
    prune: MagicMock
    with (
        app.app_context(),
        patch.object(
            version_history_retention, "_prune_old_versions_impl", return_value={}
        ) as prune,
    ):
        assert version_history_retention.prune_old_versions() == {}
    prune.assert_called_once_with(
        version_history_retention._version_history_retention_seed,
        max_per_run=1000,
        dry_run=False,
    )


@pytest.mark.parametrize("legacy", ["abc", "30d", -1.5, True, None])
def test_task_defers_invalid_legacy_retention_with_zero(
    stats: MagicMock, legacy: object, caplog: pytest.LogCaptureFixture
) -> None:
    """An unparsable legacy value in the ambiguity branch skips, not fails."""
    app: Flask = Flask(__name__)
    app.config.update(
        VERSION_HISTORY_RETENTION_DAYS=30,
        SUPERSET_VERSION_HISTORY_RETENTION_DAYS=legacy,
    )
    prune: MagicMock
    with (
        app.app_context(),
        patch.object(
            version_history_retention, "_prune_old_versions_impl", return_value={}
        ) as prune,
    ):
        assert version_history_retention.prune_old_versions() == {}
    prune.assert_called_once_with(0, max_per_run=1000, dry_run=False)
    stats.incr.assert_not_called()
    assert "Invalid SUPERSET_VERSION_HISTORY_RETENTION_DAYS" in caplog.text


@pytest.mark.parametrize("legacy", ["abc", None])
def test_task_defers_invalid_legacy_only_retention_with_zero(
    stats: MagicMock, legacy: object, caplog: pytest.LogCaptureFixture
) -> None:
    """A wholly custom config with only an unparsable legacy key skips."""
    app: Flask = Flask(__name__)
    app.config["SUPERSET_VERSION_HISTORY_RETENTION_DAYS"] = legacy
    prune: MagicMock
    with (
        app.app_context(),
        patch.object(
            version_history_retention, "_prune_old_versions_impl", return_value={}
        ) as prune,
    ):
        assert version_history_retention.prune_old_versions() == {}
    prune.assert_called_once_with(0, max_per_run=1000, dry_run=False)
    stats.incr.assert_not_called()
    assert "Invalid SUPERSET_VERSION_HISTORY_RETENTION_DAYS" in caplog.text


def test_task_normalizes_string_retention_config(stats: MagicMock) -> None:
    """String values from custom config modules are normalized to integers."""
    mock_app: MagicMock = MagicMock()
    mock_app.config = {"VERSION_HISTORY_RETENTION_DAYS": "30"}
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
    prune.assert_called_once_with(30, max_per_run=1000, dry_run=False)
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
    mock_app.config = {"VERSION_HISTORY_RETENTION_DAYS": 30}
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


@pytest.mark.parametrize("days", [-1, -2])
def test_immediate_cutoff_and_invalid_skip(stats: MagicMock, days: int) -> None:
    """Immediate pruning uses the UTC run clock; invalid negatives skip all work."""
    now: datetime = datetime(2026, 9, 23, 12, 0)
    tables: MagicMock
    run_pass: MagicMock
    with (
        patch.object(version_history_retention, "naive_utcnow", return_value=now),
        patch.object(
            version_history_retention, "_resolve_shadow_tables", return_value=[]
        ) as tables,
        patch.object(
            version_history_retention, "_run_pass_with_retry", return_value=({}, 0)
        ) as run_pass,
    ):
        result: dict[str, Any] = version_history_retention._prune_old_versions_impl(
            days
        )
    if days == -1:
        run_pass.assert_called_once_with(now, [], 0, max_prune=None)
        assert result["cutoff"] == now.isoformat()
    else:
        assert result == {"skipped": 1}
        tables.assert_not_called()
        run_pass.assert_not_called()


def test_prune_cap_accounts_only_for_committed_passes(stats: MagicMock) -> None:
    """A retried pass uses the same allowance and cannot overshoot the cap."""
    tables: version_history_retention.ShadowTables = (
        version_history_retention.ShadowTables(
            parent=[], child=[], m2m=None, transaction=MagicMock()
        )
    )
    first: dict[str, int] = {
        "candidate_count": 1000,
        "max_candidate_id": 1000,
        "pruned_transactions": 2,
    }
    second: dict[str, int] = {
        "candidate_count": 1000,
        "max_candidate_id": 2000,
        "pruned_transactions": 1,
    }
    run_pass: MagicMock
    with (
        patch.object(
            version_history_retention, "_resolve_shadow_tables", return_value=tables
        ),
        patch.object(
            version_history_retention,
            "_run_pass_with_retry",
            side_effect=[(first, 1), (second, 0)],
        ) as run_pass,
        patch.object(
            version_history_retention, "_probe_prunable", return_value=(4, False)
        ),
    ):
        result: dict[str, Any] = version_history_retention._prune_old_versions_impl(
            retention_days=30, max_per_run=3
        )

    assert result["pruned_transactions"] == 3
    assert result["retried"] == 1
    assert result["cap_reached"] is True
    assert result["remaining_eligible"] == 4
    assert result["remaining_count_complete"] is False
    stats.gauge.assert_any_call(
        "superset.versioning.retention.remaining_count_complete", 0
    )
    assert run_pass.call_args_list[0].kwargs["max_prune"] == 3
    assert run_pass.call_args_list[1].kwargs["max_prune"] == 1


def test_prune_cap_probes_after_preserved_candidate_windows(
    stats: MagicMock,
) -> None:
    """The remainder probe skips windows already scanned before the cap."""
    tables: version_history_retention.ShadowTables = (
        version_history_retention.ShadowTables(
            parent=[], child=[], m2m=None, transaction=MagicMock()
        )
    )
    batch_size: int = version_history_retention._MAX_PRUNE_BATCH
    windows: dict[int, version_history_retention._PruneWindow] = {
        0: version_history_retention._PruneWindow([], batch_size, 1000),
        1000: version_history_retention._PruneWindow([1500], batch_size, 2000),
    }

    def resolve_window(
        _conn: sa.engine.Connection,
        _cutoff: datetime,
        _shadow_tables: list[sa.Table],
        after_id: int,
        _limit: int,
    ) -> version_history_retention._PruneWindow:
        """Return the candidate window at the requested scan cursor."""
        return windows[after_id]

    resolve: MagicMock
    with (
        patch.object(
            version_history_retention, "_resolve_shadow_tables", return_value=tables
        ),
        patch.object(
            version_history_retention,
            "_run_pass_with_retry",
            side_effect=[
                ({"candidate_count": batch_size, "max_candidate_id": 1000}, 0),
                (
                    {
                        "candidate_count": batch_size,
                        "max_candidate_id": 2000,
                        "pruned_transactions": 1,
                    },
                    0,
                ),
            ],
        ),
        patch.object(version_history_retention, "db"),
        patch.object(
            version_history_retention,
            "_resolve_prune_window",
            side_effect=resolve_window,
        ) as resolve,
    ):
        result: dict[str, Any] = version_history_retention._prune_old_versions_impl(
            retention_days=30, max_per_run=1
        )

    assert result["pruned_transactions"] == 1
    assert result["remaining_eligible"] == 1
    assert result["remaining_count_complete"] is False
    assert resolve.call_args.args[3] == 1000
    stats.gauge.assert_any_call(
        "superset.versioning.retention.remaining_eligible_at_least", 1
    )


@pytest.mark.parametrize("cap", [None, 0, 3])
def test_prune_dry_run_counts_all_eligible_without_writes(
    stats: MagicMock, cap: int | None
) -> None:
    """A dry run reports the whole backlog and capped-run estimate."""
    tables: version_history_retention.ShadowTables = (
        version_history_retention.ShadowTables(
            parent=[], child=[], m2m=None, transaction=MagicMock()
        )
    )
    run_pass: MagicMock
    with (
        patch.object(
            version_history_retention, "_resolve_shadow_tables", return_value=tables
        ),
        patch.object(version_history_retention, "_count_prunable", return_value=7),
        patch.object(version_history_retention, "_run_pass_with_retry") as run_pass,
    ):
        result: dict[str, Any] = version_history_retention._prune_old_versions_impl(
            30, max_per_run=cap, dry_run=True
        )

    assert result["eligible_backlog"] == 7
    assert result["estimated_capped_runs"] == (3 if cap == 3 else 1)
    run_pass.assert_not_called()
    stats.gauge.assert_not_called()


@pytest.mark.parametrize("helper_name", ["_count_prunable", "_probe_prunable"])
def test_remainder_reads_use_default_isolation(helper_name: str) -> None:
    """Backlog measurement does not request the delete pass's isolation."""
    tables: version_history_retention.ShadowTables = (
        version_history_retention.ShadowTables(
            parent=[], child=[], m2m=None, transaction=MagicMock()
        )
    )
    engine: MagicMock = MagicMock()
    window: version_history_retention._PruneWindow = (
        version_history_retention._PruneWindow(
            prunable=[], candidate_count=0, max_candidate_id=0
        )
    )
    with (
        patch.object(version_history_retention, "db") as mock_db,
        patch.object(
            version_history_retention, "_resolve_prune_window", return_value=window
        ),
    ):
        mock_db.engine = engine
        result: int | tuple[int, bool] = getattr(
            version_history_retention, helper_name
        )(datetime(2026, 1, 1), tables)

    assert result in (0, (0, True))
    engine.connect.return_value.execution_options.assert_not_called()


def test_dry_run_count_accumulates_windows_and_closes_read_transactions() -> None:
    """A paged backlog count sums windows and releases each read snapshot."""
    tables: version_history_retention.ShadowTables = (
        version_history_retention.ShadowTables(
            parent=[], child=[], m2m=None, transaction=MagicMock()
        )
    )
    engine: MagicMock = MagicMock()
    full_window: version_history_retention._PruneWindow = (
        version_history_retention._PruneWindow(
            prunable=[1, 2],
            candidate_count=version_history_retention._MAX_PRUNE_BATCH,
            max_candidate_id=1000,
        )
    )
    final_window: version_history_retention._PruneWindow = (
        version_history_retention._PruneWindow(
            prunable=[1001], candidate_count=1, max_candidate_id=1001
        )
    )
    mock_db: MagicMock
    resolve: MagicMock
    with (
        patch.object(version_history_retention, "db") as mock_db,
        patch.object(
            version_history_retention,
            "_resolve_prune_window",
            side_effect=[full_window, final_window],
        ) as resolve,
    ):
        mock_db.engine = engine
        count: int = version_history_retention._count_prunable(
            datetime(2026, 1, 1), tables
        )

    assert count == 3
    assert resolve.call_args_list[0].args[3] == 0
    assert resolve.call_args_list[1].args[3] == full_window.max_candidate_id
    assert engine.connect.call_count == 2
    assert engine.connect.return_value.__exit__.call_count == 2
    first_exit: int = engine.mock_calls.index(call.connect().__exit__(None, None, None))
    second_connect: int = engine.mock_calls.index(call.connect(), first_exit + 1)
    assert first_exit < second_connect


@pytest.mark.parametrize("invalid", [-1, True, "3", 2.5])
def test_prune_rejects_invalid_cap_before_work(invalid: object) -> None:
    """Malformed budgets fail closed before resolving any shadow table."""
    with (
        patch.object(version_history_retention, "_resolve_shadow_tables") as resolve,
        pytest.raises(ValueError, match="VERSION_HISTORY_PRUNE_MAX"),
    ):
        version_history_retention._prune_old_versions_impl(
            30, max_per_run=cast(int | None, invalid)
        )
    resolve.assert_not_called()


def test_prune_retry_reuses_the_same_transaction_budget(stats: MagicMock) -> None:
    """A rolled-back SERIALIZABLE attempt consumes no transaction allowance."""
    tables: version_history_retention.ShadowTables = (
        version_history_retention.ShadowTables(
            parent=[], child=[], m2m=None, transaction=MagicMock()
        )
    )
    cutoff: datetime = datetime(2026, 1, 1)
    run_pass: MagicMock
    with (
        patch.object(
            version_history_retention,
            "_run_prune_pass",
            side_effect=[
                OperationalError("SELECT 1", {}, Exception("serialization conflict")),
                {"pruned_transactions": 2},
            ],
        ) as run_pass,
        patch.object(version_history_retention.time, "sleep"),
    ):
        result: tuple[dict[str, Any], int] = (
            version_history_retention._run_pass_with_retry(
                cutoff, tables, after_id=4, max_prune=2
            )
        )

    assert result == ({"pruned_transactions": 2}, 1)
    assert run_pass.call_args_list == [
        call(cutoff, tables, 4, max_prune=2),
        call(cutoff, tables, 4, max_prune=2),
    ]
    stats.incr.assert_called_once_with("superset.versioning.retention.retried")


@pytest.mark.parametrize(
    "commit_error",
    [
        OperationalError(
            "COMMIT", {}, Exception("connection lost"), connection_invalidated=True
        ),
        RuntimeError("acknowledgement lost"),
    ],
)
def test_prune_does_not_retry_an_uncertain_commit(
    stats: MagicMock, commit_error: Exception
) -> None:
    """A lost commit acknowledgement must not spend another prune window."""
    tables: version_history_retention.ShadowTables = (
        version_history_retention.ShadowTables(
            parent=[],
            child=[],
            m2m=None,
            transaction=sa.table("version_transaction", sa.column("id")),
        )
    )
    window: version_history_retention._PruneWindow = (
        version_history_retention._PruneWindow(
            prunable=[1], candidate_count=1, max_candidate_id=1
        )
    )
    engine: MagicMock = MagicMock()
    engine_connection: MagicMock = engine.connect.return_value
    connection: MagicMock = (
        engine_connection.execution_options.return_value.__enter__.return_value
    )
    transaction: MagicMock = connection.begin.return_value
    transaction.commit.side_effect = commit_error
    mock_db: MagicMock
    sleep: MagicMock
    with (
        patch.object(version_history_retention, "db") as mock_db,
        patch.object(
            version_history_retention, "_resolve_prune_window", return_value=window
        ),
        patch.object(
            version_history_retention, "_delete_for_transactions", return_value=0
        ),
        patch.object(version_history_retention.time, "sleep") as sleep,
    ):
        mock_db.engine = engine
        with pytest.raises(RuntimeError, match="commit outcome"):
            version_history_retention._run_pass_with_retry(
                datetime(2026, 1, 1), tables, after_id=0, max_prune=1
            )

    assert engine.connect.call_count == 1
    sleep.assert_not_called()
    stats.incr.assert_not_called()


def test_prune_retries_definitive_db_commit_failure(stats: MagicMock) -> None:
    """An acknowledged transaction rejection may retry the same capped window."""
    tables: version_history_retention.ShadowTables = (
        version_history_retention.ShadowTables(
            parent=[],
            child=[],
            m2m=None,
            transaction=sa.table("version_transaction", sa.column("id")),
        )
    )
    window: version_history_retention._PruneWindow = (
        version_history_retention._PruneWindow(
            prunable=[1], candidate_count=1, max_candidate_id=1
        )
    )
    engine: MagicMock = MagicMock()
    engine_connection: MagicMock = engine.connect.return_value
    connection: MagicMock = (
        engine_connection.execution_options.return_value.__enter__.return_value
    )
    transaction: MagicMock = connection.begin.return_value
    commit_error: OperationalError = OperationalError(
        "COMMIT", {}, Exception("serialization failure")
    )
    transaction.commit.side_effect = [commit_error, None]
    mock_db: MagicMock
    sleep: MagicMock
    with (
        patch.object(version_history_retention, "db") as mock_db,
        patch.object(
            version_history_retention, "_resolve_prune_window", return_value=window
        ),
        patch.object(
            version_history_retention, "_delete_for_transactions", return_value=0
        ),
        patch.object(version_history_retention.time, "sleep") as sleep,
    ):
        mock_db.engine = engine
        result: tuple[dict[str, Any], int] = (
            version_history_retention._run_pass_with_retry(
                datetime(2026, 1, 1), tables, after_id=0, max_prune=1
            )
        )

    assert result[1] == 1
    assert engine.connect.call_count == 2
    transaction.rollback.assert_called_once()
    sleep.assert_called_once()
    stats.incr.assert_called_once_with("superset.versioning.retention.retried")


def test_prune_failed_rollback_stops_retry(stats: MagicMock) -> None:
    """A failed rollback cannot be classified as a retryable rejection."""
    tables: version_history_retention.ShadowTables = (
        version_history_retention.ShadowTables(
            parent=[],
            child=[],
            m2m=None,
            transaction=sa.table("version_transaction", sa.column("id")),
        )
    )
    window: version_history_retention._PruneWindow = (
        version_history_retention._PruneWindow(
            prunable=[1], candidate_count=1, max_candidate_id=1
        )
    )
    engine: MagicMock = MagicMock()
    engine_connection: MagicMock = engine.connect.return_value
    connection: MagicMock = (
        engine_connection.execution_options.return_value.__enter__.return_value
    )
    transaction: MagicMock = connection.begin.return_value
    transaction.commit.side_effect = OperationalError(
        "COMMIT", {}, Exception("transaction rejected")
    )
    transaction.rollback.side_effect = RuntimeError("rollback failed")
    mock_db: MagicMock
    sleep: MagicMock
    with (
        patch.object(version_history_retention, "db") as mock_db,
        patch.object(
            version_history_retention, "_resolve_prune_window", return_value=window
        ),
        patch.object(
            version_history_retention, "_delete_for_transactions", return_value=0
        ),
        patch.object(version_history_retention.time, "sleep") as sleep,
    ):
        mock_db.engine = engine
        with pytest.raises(
            version_history_retention._PruneRollbackFailedError,
            match="rollback failed",
        ):
            version_history_retention._run_pass_with_retry(
                datetime(2026, 1, 1), tables, after_id=0, max_prune=1
            )

    assert engine.connect.call_count == 1
    sleep.assert_not_called()
    stats.incr.assert_not_called()


def test_scheduled_prune_rejects_invalid_cap_before_work(stats: MagicMock) -> None:
    """A malformed scheduled budget cannot enter the prune implementation."""
    app: Flask = Flask(__name__)
    app.config.update(
        VERSION_HISTORY_RETENTION_DAYS=30,
        VERSION_HISTORY_PRUNE_MAX_TRANSACTIONS_PER_RUN=-1,
    )
    prune: MagicMock
    with (
        app.app_context(),
        patch.object(version_history_retention, "_prune_old_versions_impl") as prune,
    ):
        result: dict[str, Any] = version_history_retention.prune_old_versions()

    assert result == {"skipped_invalid_cap": 1}
    prune.assert_not_called()
    stats.incr.assert_called_once_with(
        "superset.versioning.retention.skipped_invalid_cap"
    )


def test_scheduled_prune_passes_dry_run_and_cap_to_impl() -> None:
    """The scheduled wrapper preserves both operator-selected controls."""
    app: Flask = Flask(__name__)
    app.config.update(
        VERSION_HISTORY_RETENTION_DAYS=30,
        VERSION_HISTORY_PRUNE_DRY_RUN=True,
        VERSION_HISTORY_PRUNE_MAX_TRANSACTIONS_PER_RUN=2,
    )
    prune: MagicMock
    with (
        app.app_context(),
        patch.object(
            version_history_retention, "_prune_old_versions_impl", return_value={}
        ) as prune,
    ):
        result: dict[str, Any] = version_history_retention.prune_old_versions()

    assert result == {}
    prune.assert_called_once_with(30, max_per_run=2, dry_run=True)


@pytest.mark.parametrize("invalid", [None, 0, 1, "false", [], {}])
def test_scheduled_prune_skips_invalid_dry_run_before_work(
    stats: MagicMock, caplog: pytest.LogCaptureFixture, invalid: object
) -> None:
    """Malformed dry-run configuration skips without marking the task failed."""
    app: Flask = Flask(__name__)
    app.config.update(
        VERSION_HISTORY_RETENTION_DAYS=30,
        VERSION_HISTORY_PRUNE_DRY_RUN=invalid,
    )
    prune: MagicMock
    with (
        app.app_context(),
        patch.object(version_history_retention, "_prune_old_versions_impl") as prune,
    ):
        result: dict[str, Any] = version_history_retention.prune_old_versions()

    assert result == {"skipped_invalid_dry_run": 1}
    prune.assert_not_called()
    stats.incr.assert_called_once_with(
        "superset.versioning.retention.skipped_invalid_dry_run"
    )
    assert "invalid prune dry-run" in caplog.text


def test_remainder_probe_failure_does_not_mask_committed_prune(
    stats: MagicMock,
) -> None:
    """A measurement fault leaves committed deletion totals successful."""
    tables: version_history_retention.ShadowTables = (
        version_history_retention.ShadowTables(
            parent=[], child=[], m2m=None, transaction=MagicMock()
        )
    )
    with (
        patch.object(
            version_history_retention, "_resolve_shadow_tables", return_value=tables
        ),
        patch.object(
            version_history_retention,
            "_run_pass_with_retry",
            return_value=({"pruned_transactions": 2}, 0),
        ),
        patch.object(
            version_history_retention,
            "_probe_prunable",
            side_effect=OperationalError("SELECT 1", {}, Exception("database offline")),
        ),
    ):
        result: dict[str, Any] = version_history_retention._prune_old_versions_impl(
            30, max_per_run=2
        )

    assert result["pruned_transactions"] == 2
    assert result["cap_reached"] is True
    assert result["remaining_eligible"] is None
    assert result["remaining_count_complete"] is False
    stats.incr.assert_called_once_with(
        "superset.versioning.retention.remainder_probe_failed"
    )
