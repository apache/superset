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
"""Unit tests for deletion-retention configuration and window resolution.

The shared value overrides config, an unset value falls back to config, ``0``
is preserved as the disable value, and malformed supplied values defer purge.
"""

import runpy
from collections.abc import Iterator
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any, cast, ClassVar
from unittest.mock import ANY, call, MagicMock, patch
from uuid import UUID, uuid4

import pytest
import sqlalchemy as sa
from flask.config import Config
from sqlalchemy.exc import OperationalError
from sqlalchemy.orm import Mapped, mapped_column, registry, Session


@pytest.fixture
def app_config(app_context: None, monkeypatch: pytest.MonkeyPatch) -> Config:
    from flask import current_app

    current_app.config["SOFT_DELETE_RETENTION_DAYS"] = 30
    current_app.config["SOFT_DELETE_PURGE_MAX_PER_RUN"] = 0
    monkeypatch.setitem(current_app.config, "SOFT_DELETE_RETENTION_DAYS_FUNC", None)
    return current_app.config


def _resolve() -> int:
    from superset.commands.deletion_retention.window import resolve_retention_window

    return resolve_retention_window()


@pytest.mark.parametrize("days", [-1, 0, 30, 180, 360])
def test_host_policy_precedes_shared_override(app_config: Config, days: int) -> None:
    """An installed host policy is authoritative, including disabled/deferred zero."""
    app_config["SOFT_DELETE_RETENTION_DAYS_FUNC"] = lambda: days
    shared: MagicMock
    with patch(
        "superset.commands.deletion_retention.window.get_shared_value", return_value=7
    ) as shared:
        assert _resolve() == days
    shared.assert_not_called()


@pytest.mark.parametrize("value", [None, True, "360", -2, 36501])
def test_invalid_host_policy_defers_without_shared_fallback(
    app_config: Config, value: object
) -> None:
    """Malformed host results must not turn an outage into destructive fallback."""
    app_config["SOFT_DELETE_RETENTION_DAYS_FUNC"] = lambda: value
    shared: MagicMock
    with patch(
        "superset.commands.deletion_retention.window.get_shared_value", return_value=7
    ) as shared:
        assert _resolve() == 0
    shared.assert_not_called()


def test_host_policy_exception_defers_without_payload(
    app_config: Config, caplog: pytest.LogCaptureFixture
) -> None:
    """Callback failure skips purge without logging external error details."""
    app_config["SOFT_DELETE_RETENTION_DAYS_FUNC"] = MagicMock(
        side_effect=RuntimeError("private-policy-payload")
    )
    shared: MagicMock
    with patch(
        "superset.commands.deletion_retention.window.get_shared_value", return_value=7
    ) as shared:
        assert _resolve() == 0
    shared.assert_not_called()
    assert "host retention policy unavailable" in caplog.text
    assert "private-policy-payload" not in caplog.text


def test_unset_falls_back_to_config(app_config: Config) -> None:
    with patch(
        "superset.commands.deletion_retention.window.get_shared_value",
        return_value=None,
    ):
        assert _resolve() == 30


def test_shared_value_overrides_config(app_config: Config) -> None:
    with patch(
        "superset.commands.deletion_retention.window.get_shared_value",
        return_value=7,
    ):
        assert _resolve() == 7


def test_zero_shared_value_is_preserved_not_coerced(app_config: Config) -> None:
    # `0` is a meaningful "disable"; it must survive (never `or`-coerced to 30).
    with patch(
        "superset.commands.deletion_retention.window.get_shared_value",
        return_value=0,
    ):
        assert _resolve() == 0


@pytest.mark.parametrize("shared", [None, -1])
def test_immediate_window_from_shared_or_config(
    app_config: Config, shared: int | None
) -> None:
    """Both standalone configuration sources preserve immediate eligibility."""
    app_config["SOFT_DELETE_RETENTION_DAYS"] = -1
    with patch(
        "superset.commands.deletion_retention.window.get_shared_value",
        return_value=shared,
    ):
        assert _resolve() == -1


@pytest.mark.parametrize("source", ["config", "shared"])
@pytest.mark.parametrize("value", ["oops", "", -2, -3, True, False, 1.5])
def test_malformed_standalone_window_defers_purge(
    app_config: Config, source: str, value: object
) -> None:
    """Malformed supplied windows never fall through to destructive defaults."""
    import superset.tasks.deletion_retention as mod

    app_config["SOFT_DELETE_RETENTION_DAYS"] = value if source == "config" else 30
    app_config["SOFT_DELETE_PURGE_DRY_RUN"] = False
    models: MagicMock
    reconcile: MagicMock
    with (
        patch.object(mod.feature_flag_manager, "is_feature_enabled", return_value=True),
        patch(
            "superset.commands.deletion_retention.window.get_shared_value",
            return_value=value if source == "shared" else None,
        ),
        patch.object(mod, "_soft_delete_models") as models,
        patch.object(mod.audit, "reconcile_pending") as reconcile,
    ):
        assert mod.purge_soft_deleted.run() == {"skipped": 1}
    models.assert_not_called()
    reconcile.assert_not_called()


def test_explicit_none_config_defers_purge(app_config: Config) -> None:
    """Only an absent config setting uses the default retention window."""
    app_config["SOFT_DELETE_RETENTION_DAYS"] = None
    with patch(
        "superset.commands.deletion_retention.window.get_shared_value",
        return_value=None,
    ):
        assert _resolve() == 0


@pytest.mark.parametrize("source", ["config", "shared", "policy"])
@pytest.mark.parametrize("value", [-2, True, "bad", 36501, 30.0])
def test_invalid_window_resolution_is_alertable(
    app_config: Config, source: str, value: object
) -> None:
    """Each invalid resolution emits one distinct counter without purging."""
    from superset.extensions import stats_logger_manager

    app_config["SOFT_DELETE_RETENTION_DAYS"] = value if source == "config" else 30
    if source == "policy":
        app_config["SOFT_DELETE_RETENTION_DAYS_FUNC"] = lambda: value
    stats: MagicMock
    with (
        patch(
            "superset.commands.deletion_retention.window.get_shared_value",
            return_value=value if source == "shared" else None,
        ),
        patch.object(stats_logger_manager.instance, "incr") as stats,
    ):
        assert _resolve() == 0
    stats.assert_called_once_with("deletion_retention.invalid_window")


@pytest.mark.parametrize("source", ["config", "shared", "policy"])
@pytest.mark.parametrize("days", [-1, 0, 30])
def test_valid_window_does_not_emit_invalid_metric(
    app_config: Config, source: str, days: int
) -> None:
    """Intentional disable and immediate eligibility are not misconfigurations."""
    from superset.extensions import stats_logger_manager

    app_config["SOFT_DELETE_RETENTION_DAYS"] = days if source == "config" else 30
    if source == "policy":
        app_config["SOFT_DELETE_RETENTION_DAYS_FUNC"] = lambda: days
    stats: MagicMock
    with (
        patch(
            "superset.commands.deletion_retention.window.get_shared_value",
            return_value=days if source == "shared" else None,
        ),
        patch.object(stats_logger_manager.instance, "incr") as stats,
    ):
        assert _resolve() == days
    stats.assert_not_called()


def test_window_zero_disables_the_task(app_context: None) -> None:
    # A zero window short-circuits the purge entirely.
    import superset.tasks.deletion_retention as mod

    with patch.object(mod, "_soft_delete_models") as models:
        result = mod._purge_impl(0, dry_run=False)
    assert result == {"skipped": 1}
    models.assert_not_called()


def test_clock_uses_now_not_utcnow() -> None:
    import superset.tasks.deletion_retention as mod
    from superset.models.slice import Slice

    now = datetime(2026, 7, 13, 12, 0)
    with (
        patch.object(mod, "datetime") as clock,
        patch.object(mod, "_soft_delete_models", return_value=[Slice]),
        patch.object(
            mod, "_purge_model", return_value=mod._PurgeModelResult(0, 0, 0, 0, 0)
        ) as purge,
        patch.object(mod.audit, "reconcile_pending"),
    ):
        clock.now.return_value = now
        mod._purge_impl(30, dry_run=False)

    purge.assert_called_once_with(
        Slice, now - timedelta(days=30), False, max_per_run=None
    )


@pytest.mark.parametrize("dry_run", [False, True])
@pytest.mark.parametrize("row_count", [0, 1, 3])
def test_unsupported_model_is_reported_without_scanning(
    app_config: Config,
    monkeypatch: pytest.MonkeyPatch,
    caplog: pytest.LogCaptureFixture,
    dry_run: bool,
    row_count: int,
) -> None:
    """Skip unsupported models once per run, regardless of eligible row count."""
    # avoid app-init regression: model helpers require the app_config fixture first.
    from superset.models.helpers import SoftDeleteMixin
    from superset.tasks import deletion_retention as task

    monkeypatch.setattr(SoftDeleteMixin, "_registered_subclasses", [])
    mapper_registry: registry = registry()

    @mapper_registry.mapped
    class UnsupportedModel(SoftDeleteMixin):
        """A host-style model with the legacy integer scan key but no purge policy."""

        __tablename__: str = "unsupported_purge_test"
        __table__: ClassVar[sa.Table]
        id: Mapped[int] = mapped_column(primary_key=True)
        uuid: Mapped[UUID] = mapped_column(sa.Uuid, default=uuid4)

    engine: sa.Engine = sa.create_engine("sqlite://")
    monkeypatch.setitem(app_config, "SOFT_DELETE_PURGE_DRY_RUN", dry_run)
    try:
        mapper_registry.metadata.create_all(engine)
        session: Session
        with Session(engine) as session:
            if row_count:
                session.execute(
                    sa.insert(UnsupportedModel),
                    [
                        {
                            "id": index + 1,
                            "deleted_at": datetime.now() - timedelta(days=90),
                        }
                        for index in range(row_count)
                    ],
                )
            session.commit()
            scan: MagicMock
            rollback: MagicMock
            write_ahead: MagicMock
            counter: MagicMock
            gauge: MagicMock
            with (
                patch.object(task.db, "session", session),
                patch.object(session, "execute", wraps=session.execute) as scan,
                patch.object(session, "rollback", wraps=session.rollback) as rollback,
                patch.object(task.audit, "reconcile_pending"),
                patch.object(task.audit, "write_ahead") as write_ahead,
                patch.object(task, "resolve_retention_window", return_value=30),
                patch.object(
                    task.feature_flag_manager, "is_feature_enabled", return_value=True
                ),
                patch.object(task.stats_logger_manager.instance, "incr") as counter,
                patch.object(task.stats_logger_manager.instance, "gauge") as gauge,
            ):
                result: dict[str, Any] = task.purge_soft_deleted.run()
            if dry_run:
                assert result["would_purge"] == {}, result
            else:
                assert result["cascade_failures"] == 0, result
                assert result["purged"] == {}, result
                assert result["blocked_by_reference"] == 0, result
            assert result["unsupported_models"] == {"unsupported_purge_test": 1}
            scan.assert_not_called()
            rollback.assert_not_called()
            write_ahead.assert_not_called()
            gauge.assert_not_called()
            counter.assert_called_once_with(
                "deletion_retention.unsupported_models.unsupported_purge_test"
            )
            assert (
                caplog.text.count("skipping unsupported_purge_test: no purge policy")
                == 1
            )
            assert (
                session.scalar(
                    sa.select(sa.func.count()).select_from(UnsupportedModel.__table__)
                )
                == row_count
            )
    finally:
        mapper_registry.dispose()
        engine.dispose()


def test_scan_failure_keeps_the_counts_earned_before_it(app_context: None) -> None:
    """A scan that fails part-way reports itself and keeps what it purged.

    By the time a later page fails, the earlier page's deletions are
    committed. Discarding the counts would make the run's summary and its
    purge gauges understate what was actually removed.
    """
    import superset.tasks.deletion_retention as mod
    from superset.commands.deletion_retention.purge_cascade import CascadeResult
    from superset.models.slice import Slice

    purged_result: CascadeResult = CascadeResult(
        purged=True, entity_type="chart", entity_uuid="gone"
    )

    def pages(*args: Any, **kwargs: Any) -> Iterator[list[int]]:
        yield [1, 2]
        raise RuntimeError("no such column: id")

    with (
        patch.object(mod, "_iter_eligible_ids", side_effect=pages),
        patch.object(mod, "_purge_one", return_value=purged_result),
    ):
        counts: mod._PurgeModelResult = mod._purge_model(
            Slice, datetime.now(), dry_run=False
        )

    assert (counts.purged, counts.would_purge, counts.failures, counts.blocked) == (
        2,
        0,
        0,
        0,
    )
    assert counts.scan_failures == 1


def test_every_root_failing_reports_the_pass_as_failed(
    app_config: Config,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Isolation is per root; an outage that takes them all is still a failure.

    Before the per-root isolation this raised and incremented ``failed``, so
    an alert on that metric covered a metadata-database outage. It still does.
    """
    # avoid app-init regression: model helpers require the app_config fixture first.
    from superset.tasks import deletion_retention as task

    monkeypatch.setitem(app_config, "SOFT_DELETE_PURGE_DRY_RUN", False)

    def every_scan_fails(*args: Any, **kwargs: Any) -> task._PurgeModelResult:
        return task._PurgeModelResult(0, 0, 0, 0, 1)

    counter: MagicMock
    with (
        patch.object(task, "_purge_model", side_effect=every_scan_fails),
        patch.object(task.audit, "reconcile_pending"),
        patch.object(task, "resolve_retention_window", return_value=30),
        patch.object(
            task.feature_flag_manager, "is_feature_enabled", return_value=True
        ),
        patch.object(task.stats_logger_manager.instance, "incr") as counter,
        patch.object(task.stats_logger_manager.instance, "gauge"),
    ):
        result: dict[str, Any] = task.purge_soft_deleted.run()

    assert result["purged"] == {}
    assert result["scan_failures"] == len(task.purge_policy_registry())
    assert call("deletion_retention.failed") in counter.call_args_list


def test_root_without_a_table_name_does_not_abort_the_run(
    app_config: Config,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Resolving a root's table name is itself guarded.

    The name is read off the model, so a root that cannot supply one must be
    counted and skipped like any other failing root -- not end the pass before
    the roots that could have purged are reached.
    """
    # avoid app-init regression: model helpers require the app_config fixture first.
    from superset.models.helpers import SoftDeleteMixin
    from superset.tasks import deletion_retention as task

    supported_models: list[type[SoftDeleteMixin]] = list(task.purge_policy_registry())
    # Swap the registry out before declaring the class below: subclassing
    # appends to whichever list is current, so declaring it first would leave
    # it in the real one for the rest of the session.
    monkeypatch.setattr(SoftDeleteMixin, "_registered_subclasses", supported_models[:])

    class NoTableName(SoftDeleteMixin):
        """A registered root whose table name cannot be read."""

    monkeypatch.setattr(
        SoftDeleteMixin,
        "_registered_subclasses",
        [NoTableName, *supported_models],
    )
    monkeypatch.setitem(app_config, "SOFT_DELETE_PURGE_DRY_RUN", False)

    counter: MagicMock
    with (
        patch.object(
            task, "_purge_model", return_value=task._PurgeModelResult(1, 0, 0, 0, 0)
        ),
        patch.object(task.audit, "reconcile_pending"),
        patch.object(task, "resolve_retention_window", return_value=30),
        patch.object(
            task.feature_flag_manager, "is_feature_enabled", return_value=True
        ),
        patch.object(task.stats_logger_manager.instance, "incr") as counter,
        patch.object(task.stats_logger_manager.instance, "gauge"),
    ):
        result: dict[str, Any] = task.purge_soft_deleted.run()

    assert result["scan_failures"] == 1
    assert len(result["purged"]) == len(supported_models)
    # Named per root, like unsupported_models.<table>: a run-level count alone
    # cannot say which root stopped.
    assert (
        call("deletion_retention.scan_failures.NoTableName") in counter.call_args_list
    )


@pytest.mark.parametrize("dry_run", [False, True])
def test_unsupported_model_does_not_prevent_supported_models_from_purging(
    app_config: Config,
    monkeypatch: pytest.MonkeyPatch,
    caplog: pytest.LogCaptureFixture,
    dry_run: bool,
) -> None:
    """A skipped model must not stop the remaining supported models in the run."""
    # avoid app-init regression: model helpers require the app_config fixture first.
    from superset.models.helpers import SoftDeleteMixin
    from superset.tasks import deletion_retention as task

    supported_models: list[type[SoftDeleteMixin]] = list(task.purge_policy_registry())
    monkeypatch.setattr(SoftDeleteMixin, "_registered_subclasses", supported_models[:])

    class UnsupportedModel(SoftDeleteMixin):
        """An unsupported root that must never reach the row-processing boundary."""

        __tablename__: str = "unsupported_mixed_purge_test"

    # Put the unsupported model first to detect an early return or break.
    monkeypatch.setattr(
        SoftDeleteMixin,
        "_registered_subclasses",
        [UnsupportedModel, *supported_models],
    )
    monkeypatch.setitem(app_config, "SOFT_DELETE_PURGE_DRY_RUN", dry_run)
    purge: MagicMock
    counter: MagicMock
    gauge: MagicMock
    with (
        patch.object(
            task,
            "_purge_model",
            return_value=(
                task._PurgeModelResult(0, 1, 0, 0, 0)
                if dry_run
                else task._PurgeModelResult(1, 0, 0, 0, 0)
            ),
        ) as purge,
        patch.object(task.audit, "reconcile_pending"),
        patch.object(task, "resolve_retention_window", return_value=30),
        patch.object(
            task.feature_flag_manager, "is_feature_enabled", return_value=True
        ),
        patch.object(task.stats_logger_manager.instance, "incr") as counter,
        patch.object(task.stats_logger_manager.instance, "gauge") as gauge,
    ):
        result: dict[str, Any] = task.purge_soft_deleted.run()

    assert purge.call_count == len(supported_models)
    model: type[SoftDeleteMixin]
    for model in supported_models:
        assert call(model, ANY, dry_run, max_per_run=None) in purge.call_args_list
    assert result["would_purge" if dry_run else "purged"] == {
        "dashboards": 1,
        "slices": 1,
        "tables": 1,
    }
    outcome: str = "would_purge" if dry_run else "purged"
    assert gauge.call_count == 3
    gauge.assert_has_calls(
        [
            call(f"deletion_retention.{outcome}.dashboards", 1),
            call(f"deletion_retention.{outcome}.slices", 1),
            call(f"deletion_retention.{outcome}.tables", 1),
        ],
        any_order=True,
    )
    assert result["unsupported_models"] == {"unsupported_mixed_purge_test": 1}
    counter.assert_called_once_with(
        "deletion_retention.unsupported_models.unsupported_mixed_purge_test"
    )
    assert (
        caplog.text.count("skipping unsupported_mixed_purge_test: no purge policy") == 1
    )


def test_default_config_purges_for_real_after_the_retention_window() -> None:
    """The shipped defaults make the docs' retention promise true.

    Superseding ``test_default_config_is_safe``: dry-run was the
    introducing release's posture, deliberately opt-in so operators could
    validate ``would_purge`` counts against production first. Purging is
    live by default, and ``SOFT_DELETE_PURGE_DRY_RUN`` is retained as the
    operational lever to put it back. Pinned so a default change is a
    deliberate edit here rather than a silent one.
    """
    from superset import config

    assert config.SOFT_DELETE_RETENTION_DAYS == 30
    assert config.SOFT_DELETE_PURGE_DRY_RUN is False


def test_default_celery_config_registers_daily_purge() -> None:
    from superset import config

    assert "superset.tasks.deletion_retention" in config.CeleryConfig.imports
    entry: dict[str, Any] = config.CeleryConfig.beat_schedule[
        "deletion_retention.purge_soft_deleted"
    ]
    assert entry["task"] == "deletion_retention.purge_soft_deleted"
    assert entry["schedule"].minute == {0}
    assert entry["schedule"].hour == {0}


def test_docker_celery_config_registers_daily_purge() -> None:
    config_path = Path(__file__).parents[3] / "docker/pythonpath_dev/superset_config.py"
    with patch("flask_caching.backends.filesystemcache.FileSystemCache"):
        docker_config: dict[str, Any] = runpy.run_path(str(config_path))
    celery_config: type[Any] = docker_config["CeleryConfig"]

    assert "superset.tasks.deletion_retention" in celery_config.imports
    entry: dict[str, Any] = celery_config.beat_schedule[
        "deletion_retention.purge_soft_deleted"
    ]
    assert entry["task"] == "deletion_retention.purge_soft_deleted"
    assert entry["schedule"].minute == {0}
    assert entry["schedule"].hour == {0}


def test_purge_suppression_is_session_scoped() -> None:
    from superset.commands.deletion_retention.purge_cascade import (
        suppress_purge_association_versions,
    )

    existing = object()
    purge_statement = object()
    unit_of_work = MagicMock()
    unit_of_work.pending_statements = [existing]
    manager = MagicMock()
    manager.options = {"versioning": True, "native_versioning": False}
    manager.unit_of_work.return_value = unit_of_work
    session = MagicMock()

    with patch("sqlalchemy_continuum.versioning_manager", manager):
        with suppress_purge_association_versions(session):
            assert manager.options["versioning"] is True
            unit_of_work.pending_statements.append(purge_statement)

    assert unit_of_work.pending_statements == [existing]
    manager.unit_of_work.assert_called_once_with(session)


def test_purge_model_counts_only_committed_deletions(app_context: None) -> None:
    import superset.tasks.deletion_retention as mod
    from superset.commands.deletion_retention.purge_cascade import CascadeResult
    from superset.models.slice import Slice

    lost_race: CascadeResult = CascadeResult(
        purged=False, entity_type="chart", entity_uuid="lost-race"
    )
    with (
        patch.object(mod, "_iter_eligible_ids", return_value=[[1]]),
        patch.object(mod, "_purge_one", return_value=lost_race),
    ):
        result: mod._PurgeModelResult = mod._purge_model(
            Slice, datetime.now(), dry_run=False
        )

    assert result == mod._PurgeModelResult(0, 0, 0, 0, 0)


def test_purge_cap_skips_blocked_and_failed_roots(app_context: None) -> None:
    """Blocked and failed attempts leave budget for two successful roots."""
    import superset.tasks.deletion_retention as task
    from superset.commands.deletion_retention.purge_cascade import CascadeResult
    from superset.commands.deletion_retention.purge_policy import BlockerReason
    from superset.models.slice import Slice

    blocked: CascadeResult = CascadeResult(
        purged=False,
        entity_type="chart",
        entity_uuid="blocked",
        blocker=BlockerReason("referenced", "still referenced"),
    )
    confirmed: CascadeResult = CascadeResult(
        purged=True, entity_type="chart", entity_uuid="confirmed"
    )
    purge_one: MagicMock
    with (
        patch.object(task, "_iter_eligible_ids", return_value=[[1, 2, 3, 4]]),
        patch.object(
            task,
            "_purge_one",
            side_effect=[blocked, RuntimeError("cascade failed"), confirmed, confirmed],
        ) as purge_one,
    ):
        counts: task._PurgeModelResult = task._purge_model(
            Slice, datetime.now(), dry_run=False, max_per_run=2
        )

    assert (
        counts.purged,
        counts.would_purge,
        counts.failures,
        counts.blocked,
    ) == (2, 0, 1, 1)
    assert [entry.args[1] for entry in purge_one.call_args_list] == [1, 2, 3, 4]


def test_purge_model_returns_named_counts(app_context: None) -> None:
    """Callers can read each purge count without depending on tuple order."""
    import superset.tasks.deletion_retention as task
    from superset.models.slice import Slice

    with patch.object(task, "_iter_eligible_ids", return_value=[]):
        counts: task._PurgeModelResult = task._purge_model(
            Slice, datetime.now(), dry_run=False
        )

    assert counts.purged == 0
    assert counts.would_purge == 0
    assert counts.failures == 0
    assert counts.blocked == 0
    assert counts.scan_failures == 0


@pytest.mark.parametrize(
    "commit_error",
    [
        RuntimeError("acknowledgement lost"),
        OperationalError(
            "COMMIT", {}, Exception("connection lost"), connection_invalidated=True
        ),
    ],
)
def test_uncertain_purge_commit_preserves_pending_audit(
    app_context: None, commit_error: Exception
) -> None:
    """A lost commit acknowledgement cannot be recorded as a failed purge."""
    import superset.tasks.deletion_retention as task
    from superset.commands.deletion_retention.purge_cascade import CascadeResult
    from superset.models.slice import Slice

    entity: MagicMock = MagicMock(id=1)
    result: CascadeResult = CascadeResult(
        purged=True, entity_type="chart", entity_uuid="uncertain"
    )
    audit_fail: MagicMock
    audit_confirm: MagicMock
    with (
        patch.object(task, "skip_visibility_filter"),
        patch.object(task, "entity_uuid", return_value="uuid-1"),
        patch.object(task, "dashboard_slice_count", return_value=0),
        patch.object(task, "suppress_purge_association_versions"),
        patch.object(task, "cascade_hard_delete", return_value=result),
        patch.object(task.db, "session") as session,
        patch.object(task.audit, "write_ahead", return_value=uuid4()),
        patch.object(task.audit, "fail") as audit_fail,
        patch.object(task.audit, "confirm") as audit_confirm,
    ):
        session.get.return_value = entity
        session.commit.side_effect = commit_error
        with pytest.raises(RuntimeError, match="commit outcome"):
            task._purge_one(Slice, 1, datetime.now())

    audit_fail.assert_not_called()
    audit_confirm.assert_not_called()


def test_failed_commit_rollback_stops_remaining_purge_roots(
    app_context: None,
) -> None:
    """An unconfirmed rollback leaves audit pending and stops later roots."""
    import superset.tasks.deletion_retention as task
    from superset.commands.deletion_retention.purge_cascade import CascadeResult
    from superset.models.slice import Slice

    entity: MagicMock = MagicMock(id=1)
    cascade_result: CascadeResult = CascadeResult(
        purged=True, entity_type="chart", entity_uuid="uncertain"
    )
    audit_fail: MagicMock
    audit_confirm: MagicMock
    with (
        patch.object(task, "_iter_eligible_ids", return_value=[[1, 2]]),
        patch.object(task, "skip_visibility_filter"),
        patch.object(task, "entity_uuid", return_value="uuid-1"),
        patch.object(task, "dashboard_slice_count", return_value=0),
        patch.object(task, "suppress_purge_association_versions"),
        patch.object(task, "cascade_hard_delete", return_value=cascade_result),
        patch.object(task.db, "session") as session,
        patch.object(task.audit, "write_ahead", return_value=uuid4()),
        patch.object(task.audit, "fail") as audit_fail,
        patch.object(task.audit, "confirm") as audit_confirm,
    ):
        session.get.return_value = entity
        session.commit.side_effect = OperationalError(
            "COMMIT", {}, Exception("transaction rejected")
        )
        session.rollback.side_effect = [None, RuntimeError("rollback failed")]
        result: task._PurgeModelResult = task._purge_model(
            Slice, datetime.now(), dry_run=False, max_per_run=2
        )

    assert result.commit_uncertain is True
    assert result.failures == 0
    assert result.purged == 0
    assert session.get.call_count == 2
    assert session.commit.call_count == 1
    assert session.rollback.call_count == 2
    audit_fail.assert_not_called()
    audit_confirm.assert_not_called()


@pytest.mark.parametrize("failure_stage", ["flush", "commit"])
def test_definitive_purge_db_failure_finalizes_audit(
    app_context: None, failure_stage: str
) -> None:
    """An acknowledged database rejection is a failed root, not uncertainty."""
    import superset.tasks.deletion_retention as task
    from superset.commands.deletion_retention.purge_cascade import CascadeResult
    from superset.models.slice import Slice

    entity: MagicMock = MagicMock(id=1)
    result: CascadeResult = CascadeResult(
        purged=True, entity_type="chart", entity_uuid="rejected"
    )
    db_error: OperationalError = OperationalError(
        failure_stage, {}, Exception("transaction rejected")
    )
    audit_fail: MagicMock
    with (
        patch.object(task, "skip_visibility_filter"),
        patch.object(task, "entity_uuid", return_value="uuid-1"),
        patch.object(task, "dashboard_slice_count", return_value=0),
        patch.object(task, "suppress_purge_association_versions"),
        patch.object(task, "cascade_hard_delete", return_value=result),
        patch.object(task.db, "session") as session,
        patch.object(task.audit, "write_ahead", return_value=uuid4()),
        patch.object(task.audit, "fail") as audit_fail,
    ):
        session.get.return_value = entity
        getattr(session, failure_stage).side_effect = db_error
        with pytest.raises(OperationalError):
            task._purge_one(Slice, 1, datetime.now())

    audit_fail.assert_called_once()
    session.rollback.assert_called()
    if failure_stage == "flush":
        session.commit.assert_not_called()


def test_uncertain_purge_commit_stops_other_roots_and_reserves_cap(
    app_context: None,
) -> None:
    """A possible committed root spends budget and defers the invocation."""
    import superset.tasks.deletion_retention as task
    from superset.commands.deletion_retention.purge_cascade import CascadeResult
    from superset.models.dashboard import Dashboard
    from superset.models.slice import Slice

    confirmed: CascadeResult = CascadeResult(
        purged=True, entity_type="chart", entity_uuid="confirmed"
    )
    purge_one: MagicMock
    count_eligible: MagicMock
    with (
        patch.object(task, "_ordered_purge_models", return_value=[Slice, Dashboard]),
        patch.object(task, "_iter_eligible_ids", return_value=[[1, 2]]),
        patch.object(
            task,
            "_purge_one",
            side_effect=[
                confirmed,
                task._PurgeCommitUncertainError("commit outcome unknown"),
            ],
        ) as purge_one,
        patch.object(task, "_count_eligible") as count_eligible,
        patch.object(task.audit, "reconcile_pending"),
    ):
        stats: dict[str, Any] = task._purge_impl(30, False, max_per_run=2)

    assert stats["purged"] == {"slices": 1}
    assert stats["commit_uncertain"] is True
    assert stats["cap_reached"] is True
    assert stats["remaining_eligible"] is None
    assert stats["remaining_count_complete"] is False
    assert [entry.args[1] for entry in purge_one.call_args_list] == [1, 2]
    count_eligible.assert_not_called()


def test_uncertain_purge_commit_stops_remaining_ids_in_batch(
    app_context: None,
) -> None:
    """A possible committed root stops a model before the next eligible ID."""
    import superset.tasks.deletion_retention as task
    from superset.commands.deletion_retention.purge_cascade import CascadeResult
    from superset.models.slice import Slice

    confirmed: CascadeResult = CascadeResult(
        purged=True, entity_type="chart", entity_uuid="confirmed"
    )
    purge_one: MagicMock
    with (
        patch.object(task, "_iter_eligible_ids", return_value=[[1, 2, 3]]),
        patch.object(
            task,
            "_purge_one",
            side_effect=[
                confirmed,
                task._PurgeCommitUncertainError("commit outcome unknown"),
                confirmed,
            ],
        ) as purge_one,
    ):
        counts: task._PurgeModelResult = task._purge_model(
            Slice, datetime.now(), dry_run=False, max_per_run=2
        )

    assert counts.purged == 1
    assert counts.commit_uncertain is True
    assert [entry.args[1] for entry in purge_one.call_args_list] == [1, 2]


def test_uncertain_purge_commit_stops_next_batch_with_budget_remaining(
    app_context: None,
) -> None:
    """An uncertain commit must not spend the unused cap on a later page."""
    import superset.tasks.deletion_retention as task
    from superset.commands.deletion_retention.purge_cascade import CascadeResult
    from superset.models.slice import Slice

    confirmed: CascadeResult = CascadeResult(
        purged=True, entity_type="chart", entity_uuid="confirmed"
    )
    purge_one: MagicMock
    with (
        patch.object(task, "_iter_eligible_ids", return_value=[[1, 2], [3]]),
        patch.object(
            task,
            "_purge_one",
            side_effect=[
                confirmed,
                task._PurgeCommitUncertainError("commit outcome unknown"),
                confirmed,
            ],
        ) as purge_one,
    ):
        counts: task._PurgeModelResult = task._purge_model(
            Slice, datetime.now(), dry_run=False, max_per_run=3
        )

    assert counts.purged == 1
    assert counts.commit_uncertain is True
    assert [entry.args[1] for entry in purge_one.call_args_list] == [1, 2]


def test_uncertain_purge_commit_stops_next_model_with_budget_remaining(
    app_context: None,
) -> None:
    """An unknown outcome halts the run even when the cap is not exhausted."""
    import superset.tasks.deletion_retention as task
    from superset.models.dashboard import Dashboard
    from superset.models.slice import Slice

    purge_model: MagicMock
    with (
        patch.object(task, "_ordered_purge_models", return_value=[Slice, Dashboard]),
        patch.object(
            task,
            "_purge_model",
            side_effect=[
                task._PurgeModelResult(
                    purged=0,
                    would_purge=0,
                    failures=0,
                    blocked=0,
                    scan_failures=0,
                    commit_uncertain=True,
                ),
                task._PurgeModelResult(
                    purged=1, would_purge=0, failures=0, blocked=0, scan_failures=0
                ),
            ],
        ) as purge_model,
    ):
        scan: task._PurgeScan = task._scan_purge_models(
            datetime.now(), dry_run=False, max_per_run=5
        )

    assert scan.commit_uncertain is True
    assert scan.remaining_budget == 4
    assert purge_model.call_count == 1


def test_post_commit_audit_exception_still_spends_cap(app_context: None) -> None:
    """A committed deletion retains its cap slot if audit finalization raises."""
    import superset.tasks.deletion_retention as task
    from superset.commands.deletion_retention.purge_cascade import CascadeResult
    from superset.models.slice import Slice

    entity: MagicMock = MagicMock(id=1)
    result: CascadeResult = CascadeResult(
        purged=True, entity_type="chart", entity_uuid="committed"
    )
    cascade: MagicMock
    audit_fail: MagicMock
    with (
        patch.object(task, "_iter_eligible_ids", return_value=[[1, 2]]),
        patch.object(task, "skip_visibility_filter"),
        patch.object(task, "entity_uuid", return_value="uuid-1"),
        patch.object(task, "dashboard_slice_count", return_value=0),
        patch.object(task, "suppress_purge_association_versions"),
        patch.object(task, "cascade_hard_delete", return_value=result) as cascade,
        patch.object(task.db, "session") as session,
        patch.object(task.audit, "write_ahead", return_value=uuid4()),
        patch.object(task.audit, "confirm", side_effect=RuntimeError("audit offline")),
        patch.object(task.audit, "fail") as audit_fail,
    ):
        session.get.return_value = entity
        counts: task._PurgeModelResult = task._purge_model(
            Slice, datetime.now(), dry_run=False, max_per_run=1
        )

    assert counts.purged == 1
    assert counts.failures == 0
    assert cascade.call_count == 1
    session.commit.assert_called_once()
    audit_fail.assert_not_called()


def test_dry_run_backlog_is_incomplete_after_scan_failure(app_context: None) -> None:
    """A partial model scan cannot yield a definitive dry-run estimate."""
    import superset.tasks.deletion_retention as task
    from superset.models.slice import Slice

    scan: task._PurgeScan = task._PurgeScan(
        purged={},
        would_purge={"slices": 2},
        unsupported_models={},
        failures=0,
        blocked=0,
        remaining_budget=3,
        supported_models=[Slice],
        scan_failures=1,
        attempted=1,
    )
    with patch.object(task, "_scan_purge_models", return_value=scan):
        stats: dict[str, Any] = task._purge_impl(30, True, max_per_run=3)

    assert stats["would_purge"] == {"slices": 2}
    assert stats["eligible_backlog"] is None
    assert stats["estimated_capped_runs"] is None
    assert stats["backlog_count_complete"] is False


def test_scheduled_purge_fails_closed_when_write_ahead_fails(
    app_context: None,
) -> None:
    """An unauditable scheduled purge must not delete: the entity is
    skipped (counted as a failure) and retried next run."""
    import superset.tasks.deletion_retention as mod
    from superset.models.slice import Slice

    entity = MagicMock(id=1)
    with (
        patch.object(mod, "_iter_eligible_ids", return_value=[[1]]),
        patch.object(mod, "skip_visibility_filter"),
        patch.object(mod, "entity_uuid", return_value="u-1"),
        patch.object(mod, "dashboard_slice_count", return_value=0),
        patch.object(mod, "cascade_hard_delete") as cascade,
        patch.object(mod.db, "session") as session,
        patch.object(mod.audit, "write_ahead", return_value=None),
    ):
        session.get.return_value = entity
        result: mod._PurgeModelResult = mod._purge_model(
            Slice, datetime.now(), dry_run=False
        )

    cascade.assert_not_called()
    assert (result.purged, result.would_purge, result.blocked) == (0, 0, 0)
    assert result.failures == 1


@pytest.mark.parametrize("days", [-1, -2])
def test_immediate_cutoff_and_invalid_skip(days: int) -> None:
    """Immediate eligibility uses now; invalid negatives never start a purge."""
    import superset.tasks.deletion_retention as mod
    from superset.models.slice import Slice

    now: datetime = datetime(2026, 9, 23, 12, 0)
    clock: MagicMock
    models: MagicMock
    purge: MagicMock
    reconcile: MagicMock
    with (
        patch.object(mod, "datetime") as clock,
        patch.object(mod, "_soft_delete_models", return_value=[Slice]) as models,
        patch.object(
            mod, "_purge_model", return_value=mod._PurgeModelResult(0, 0, 0, 0, 0)
        ) as purge,
        patch.object(mod.audit, "reconcile_pending") as reconcile,
    ):
        clock.now.return_value = now
        result: dict[str, Any] = mod._purge_impl(days, dry_run=False)
    if days == -1:
        purge.assert_called_once_with(Slice, now, False, max_per_run=None)
    else:
        assert result == {"skipped": 1}
        models.assert_not_called()
        purge.assert_not_called()
        reconcile.assert_not_called()


@pytest.mark.parametrize("source", ["config", "shared"])
@pytest.mark.parametrize("days, expected", [(36500, 36500), (36501, 0), (1000000, 0)])
def test_standalone_window_bounds_reach_safe_purge_cutoff(
    app_config: Config, source: str, days: int, expected: int
) -> None:
    """Stored and runtime windows cannot overflow scheduled purge arithmetic."""
    import superset.tasks.deletion_retention as mod
    from superset.models.slice import Slice

    app_config["SOFT_DELETE_RETENTION_DAYS"] = days if source == "config" else 30
    now: datetime = datetime(2026, 9, 23, 12, 0)
    clock: MagicMock
    purge: MagicMock
    with (
        patch(
            "superset.commands.deletion_retention.window.get_shared_value",
            return_value=days if source == "shared" else None,
        ),
        patch.object(mod, "datetime") as clock,
        patch.object(mod, "_soft_delete_models", return_value=[Slice]),
        patch.object(
            mod, "_purge_model", return_value=mod._PurgeModelResult(0, 0, 0, 0, 0)
        ) as purge,
        patch.object(mod.audit, "reconcile_pending"),
    ):
        clock.now.return_value = now
        result: dict[str, Any] = mod._purge_impl(_resolve(), dry_run=False)
    if expected == 0:
        assert result == {"skipped": 1}
        purge.assert_not_called()
    else:
        purge.assert_called_once_with(
            Slice, now - timedelta(days=expected), False, max_per_run=None
        )


def test_count_eligible_counts_only_roots_archived_before_cutoff(
    session: Session, app_context: None
) -> None:
    """The backlog count runs its real predicate and agrees with the purge scan."""
    from superset.models.slice import Slice
    from superset.tasks import deletion_retention as task

    table: sa.Table = Slice.__table__
    table.create(session.get_bind())
    cutoff: datetime = datetime(2026, 1, 31)
    # Core inserts keep Slice's ORM listeners out of a predicate-only test.
    session.execute(
        sa.insert(table),
        [
            {"id": 1, "deleted_at": cutoff - timedelta(days=1)},
            {"id": 2, "deleted_at": cutoff - timedelta(seconds=1)},
            {"id": 3, "deleted_at": cutoff},
            {"id": 4, "deleted_at": cutoff + timedelta(days=1)},
            {"id": 5, "deleted_at": None},
        ],
    )
    session.commit()

    assert task._count_eligible(Slice, cutoff) == 2
    assert list(task._iter_eligible_ids(Slice, cutoff, batch=10)) == [[1, 2]]


def test_purge_cap_counts_committed_roots_across_batches(app_context: None) -> None:
    """A failed or blocked root does not consume the successful-purge budget."""
    from superset.commands.deletion_retention.purge_cascade import CascadeResult
    from superset.models.slice import Slice
    from superset.tasks import deletion_retention as task

    purged: CascadeResult = CascadeResult(
        purged=True, entity_type="chart", entity_uuid="purged"
    )
    not_purged: CascadeResult = CascadeResult(
        purged=False, entity_type="chart", entity_uuid="not-purged"
    )
    purge_one: MagicMock
    with (
        patch.object(task, "_iter_eligible_ids", return_value=[[1, 2], [3, 4]]) as scan,
        patch.object(
            task, "_purge_one", side_effect=[not_purged, purged, purged]
        ) as purge_one,
    ):
        result: task._PurgeModelResult = task._purge_model(
            Slice, datetime.now(), dry_run=False, max_per_run=2
        )

    assert result == task._PurgeModelResult(2, 0, 0, 0, 0)
    assert [call.args[1] for call in purge_one.call_args_list] == [1, 2, 3]
    scan.assert_called_once()


def test_scheduled_purge_forwards_positive_cap(app_config: Config) -> None:
    """The scheduled entrypoint preserves the operator's positive purge budget."""
    from superset.tasks import deletion_retention as task

    app_config["SOFT_DELETE_PURGE_MAX_PER_RUN"] = 2
    app_config["SOFT_DELETE_RETENTION_DAYS"] = 30
    app_config["SOFT_DELETE_PURGE_DRY_RUN"] = False
    purge: MagicMock
    with (
        patch.object(task, "_purge_impl", return_value={"purged": 2}) as purge,
        patch.object(task, "resolve_retention_window", return_value=30),
        patch.object(
            task.feature_flag_manager, "is_feature_enabled", return_value=True
        ),
    ):
        result: dict[str, Any] = task.purge_soft_deleted.run()

    purge.assert_called_once_with(30, False, max_per_run=2)
    assert result == {"purged": 2}


def test_scheduled_purge_rejects_invalid_cap_before_work(app_config: Config) -> None:
    """Malformed scheduled budgets fail closed instead of removing everything."""
    from superset.tasks import deletion_retention as task

    app_config["SOFT_DELETE_PURGE_MAX_PER_RUN"] = -1
    purge: MagicMock
    with (
        patch.object(task, "_purge_impl") as purge,
        patch.object(
            task.feature_flag_manager, "is_feature_enabled", return_value=True
        ),
    ):
        result: dict[str, Any] = task.purge_soft_deleted.run()

    assert result == {"skipped_invalid_cap": 1}
    purge.assert_not_called()


def test_purge_budget_spans_models_and_runs(app_context: None) -> None:
    """A full first run leaves later models for a subsequent invocation."""
    from superset.models.dashboard import Dashboard
    from superset.models.slice import Slice
    from superset.tasks import deletion_retention as task

    purge: MagicMock
    with (
        patch.object(task, "_ordered_purge_models", return_value=[Slice, Dashboard]),
        patch.object(
            task,
            "_purge_model",
            side_effect=[
                task._PurgeModelResult(2, 0, 0, 0, 0),
                task._PurgeModelResult(0, 0, 0, 0, 0),
                task._PurgeModelResult(1, 0, 0, 0, 0),
            ],
        ) as purge,
        patch.object(task, "_count_eligible", side_effect=[0, 3, 0, 2]),
        patch.object(task.audit, "reconcile_pending"),
    ):
        first: dict[str, Any] = task._purge_impl(30, False, max_per_run=2)
        second: dict[str, Any] = task._purge_impl(30, False, max_per_run=2)

    assert first["purged"] == {"slices": 2}
    assert first["cap_reached"] is True
    assert first["remaining_eligible"] == 3
    assert second["purged"] == {"dashboards": 1}
    assert second["cap_reached"] is False
    assert second["remaining_eligible"] == 2
    assert [entry.args[0] for entry in purge.call_args_list] == [
        Slice,
        Slice,
        Dashboard,
    ]
    assert [entry.kwargs["max_per_run"] for entry in purge.call_args_list] == [
        2,
        2,
        2,
    ]


def test_purge_budget_remaining_after_first_model(app_context: None) -> None:
    """A partially used cap limits the next model's eligible roots."""
    from superset.commands.deletion_retention.purge_cascade import CascadeResult
    from superset.models.dashboard import Dashboard
    from superset.models.slice import Slice
    from superset.tasks import deletion_retention as task

    cutoff: datetime = datetime(2026, 10, 1)
    scan: task._PurgeScan
    purge_one: MagicMock
    with (
        patch.object(task, "_ordered_purge_models", return_value=[Slice, Dashboard]),
        patch.object(
            task, "_iter_eligible_ids", side_effect=[iter([[1]]), iter([[2, 3]])]
        ),
        patch.object(
            task,
            "_purge_one",
            return_value=CascadeResult(
                purged=True, entity_type="chart", entity_uuid="x"
            ),
        ) as purge_one,
    ):
        scan = task._scan_purge_models(cutoff, dry_run=False, max_per_run=2)

    assert scan.purged == {"slices": 1, "dashboards": 1}
    assert scan.remaining_budget == 0
    assert [entry.args[:2] for entry in purge_one.call_args_list] == [
        (Slice, 1),
        (Dashboard, 2),
    ]


def test_partial_scan_failure_preserves_counts_and_shared_budget(
    app_context: None,
) -> None:
    """A failed page keeps committed purges and leaves budget for another root."""
    from superset.models.dashboard import Dashboard
    from superset.models.slice import Slice
    from superset.tasks import deletion_retention as task

    with (
        patch.object(task, "_ordered_purge_models", return_value=[Slice, Dashboard]),
        patch.object(
            task,
            "_purge_model",
            side_effect=[
                task._PurgeModelResult(1, 0, 0, 0, 1),
                task._PurgeModelResult(1, 0, 0, 0, 0),
            ],
        ) as purge,
        patch.object(task.stats_logger_manager.instance, "incr"),
    ):
        scan: task._PurgeScan = task._scan_purge_models(
            datetime(2026, 10, 7), dry_run=False, max_per_run=2
        )

    assert scan.purged == {"slices": 1, "dashboards": 1}
    assert scan.scan_failures == 1
    assert scan.remaining_budget == 0
    assert [entry.kwargs["max_per_run"] for entry in purge.call_args_list] == [2, 1]


def test_purge_model_priority_rotates_across_days() -> None:
    """A cap smaller than the model count still gives each model first turn."""
    from superset.connectors.sqla.models import SqlaTable
    from superset.models.dashboard import Dashboard
    from superset.models.helpers import SoftDeleteMixin
    from superset.models.slice import Slice
    from superset.tasks import deletion_retention as task

    models: list[type[SoftDeleteMixin]] = [Slice, Dashboard, SqlaTable]
    with patch.object(task, "_soft_delete_models", return_value=models):
        day: int
        priorities: set[type[SoftDeleteMixin]] = set()
        for day in (1, 2, 3):
            priorities.add(task._ordered_purge_models(datetime(2026, 1, day))[0])

    assert priorities == set(models)


@pytest.mark.parametrize("cap", [None, 0, 3])
def test_purge_dry_run_counts_full_backlog_without_writes(
    app_context: None, cap: int | None
) -> None:
    """Dry-run eligibility is independent of a configured deletion budget."""
    from superset.models.dashboard import Dashboard
    from superset.models.slice import Slice
    from superset.tasks import deletion_retention as task

    purge_one: MagicMock
    reconcile: MagicMock
    with (
        patch.object(task, "_ordered_purge_models", return_value=[Slice, Dashboard]),
        patch.object(
            task,
            "_iter_eligible_ids",
            side_effect=[
                iter([[1, 2], [3, 4]]),
                iter([[5, 6, 7]]),
            ],
        ),
        patch.object(task, "_purge_one") as purge_one,
        patch.object(task.audit, "reconcile_pending") as reconcile,
    ):
        result: dict[str, Any] = task._purge_impl(30, True, max_per_run=cap)

    assert result["would_purge"] == {"slices": 4, "dashboards": 3}
    purge_one.assert_not_called()
    reconcile.assert_not_called()
    assert result["eligible_backlog"] == 7
    assert result["estimated_capped_runs"] == (3 if cap == 3 else 1)


@pytest.mark.parametrize("invalid", [-1, True, "2", 1.5])
def test_purge_rejects_invalid_cap(invalid: object) -> None:
    """Invalid budgets cannot silently become an unlimited direct call."""
    from superset.tasks import deletion_retention as task

    with pytest.raises(ValueError, match="SOFT_DELETE_PURGE_MAX_PER_RUN"):
        task._purge_impl(30, False, max_per_run=cast(int | None, invalid))


def test_purge_remainder_failure_keeps_committed_totals(app_context: None) -> None:
    """A post-commit count failure cannot turn successful purges into an error."""
    from superset.models.slice import Slice
    from superset.tasks import deletion_retention as task

    scan: task._PurgeScan = task._PurgeScan(
        purged={"slices": 2},
        would_purge={},
        unsupported_models={},
        failures=0,
        blocked=0,
        remaining_budget=0,
        supported_models=[Slice],
    )
    with (
        patch.object(task, "_scan_purge_models", return_value=scan),
        patch.object(task, "_count_eligible", side_effect=RuntimeError("count failed")),
        patch.object(task.audit, "reconcile_pending"),
        patch.object(task.db.session, "rollback") as rollback,
    ):
        result: dict[str, Any] = task._purge_impl(30, False, max_per_run=2)

    assert result["purged"] == {"slices": 2}
    assert result["cap_reached"] is True
    assert result["remaining_eligible"] is None
    assert result["remaining_count_complete"] is False
    rollback.assert_called_once()


def test_purge_remainder_incomplete_after_scan_failure(app_context: None) -> None:
    """An unscanned root cannot be silently omitted from a complete count."""
    from superset.models.slice import Slice
    from superset.tasks import deletion_retention as task

    scan: task._PurgeScan = task._PurgeScan(
        purged={},
        would_purge={},
        unsupported_models={},
        failures=0,
        blocked=0,
        remaining_budget=1,
        supported_models=[Slice],
        scan_failures=1,
        attempted=2,
    )
    with (
        patch.object(task, "_scan_purge_models", return_value=scan),
        patch.object(task, "_count_eligible", return_value=0),
        patch.object(task.audit, "reconcile_pending"),
    ):
        result: dict[str, Any] = task._purge_impl(30, False, max_per_run=1)

    assert result["remaining_eligible"] is None
    assert result["remaining_count_complete"] is False
